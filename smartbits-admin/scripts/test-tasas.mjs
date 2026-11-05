import {
  sanitizarNumeroTasa,
  esTasaAceptable,
  esTasaCoherenteCon,
  corregirTasaSeparadorMiles,
  normalizarTasas,
  resolverTasaCalculo,
  UMBRAL_TASA_MINIMA,
} from '../src/utils/tasasCambio.js';

// Datos reales del 05-nov-2026
const BCV_USD = 894.8876;
const BCV_EUR_REAL = 1006.03;      // Valor real del BCV ("1.006,03")
const BCV_EUR_API_ROTA = 1.006;    // Lo que devuelve DolarApi ("1.006")
const BINANCE = 1010;

let fallos = 0;

function check(nombre, condicion, detalle = '') {
  const estado = condicion ? '✅' : '❌';
  if (!condicion) fallos++;
  console.log(`${estado} ${nombre}${detalle ? ` -> ${detalle}` : ''}`);
}

console.log('\n=== 1. Sanitizado ===');
check('Sanitiza 894.8876 sin perder decimales', sanitizarNumeroTasa(894.8876) === 894.8876);
check('Sanitiza "997,92" con coma', sanitizarNumeroTasa('997,92') === 997.92);
check('No destruye el valor 1.006 (separador de miles)', sanitizarNumeroTasa(1.006) === 1.006);
check('Rechaza null', sanitizarNumeroTasa(null) === null);
check('Rechaza 0', sanitizarNumeroTasa(0) === null);
check('Rechaza negativos', sanitizarNumeroTasa(-5) === null);

console.log('\n=== 2. Rango economico ===');
check(`Tasa 1.006 NO es aceptable (min ${UMBRAL_TASA_MINIMA})`, !esTasaAceptable(1.006));
check('Tasa 1006.03 SÍ es aceptable', esTasaAceptable(1006.03));
check('Tasa 894.89 SÍ es aceptable', esTasaAceptable(894.89));

console.log('\n=== 3. Coherencia entre tasas ===');
check('Euro 1006.03 coherente con USD 894.89', esTasaCoherenteCon(BCV_EUR_REAL, BCV_USD));
check('Euro 1.006 incoherente con USD 894.89', !esTasaCoherenteCon(BCV_EUR_API_ROTA, BCV_USD));
check('USD 894.89 coherente con Binance 1010', esTasaCoherenteCon(BCV_USD, BINANCE));

console.log('\n=== 4. Correccion del separador de miles ===');
const corregida = corregirTasaSeparadorMiles(BCV_EUR_API_ROTA, BCV_USD);
check('1.006 se corrige a 1006', Math.abs(corregida - 1006) < 0.01, `valor: ${corregida}`);
check('1006.03 NO se modifica', corregirTasaSeparadorMiles(BCV_EUR_REAL, BCV_USD) === BCV_EUR_REAL);
check('894.8876 NO se modifica', corregirTasaSeparadorMiles(BCV_USD, BINANCE) === BCV_USD);
check('Basura (0.5) no se "corrige" a algo plausible', corregirTasaSeparadorMiles(0.5, BCV_USD) === null);

console.log('\n=== 5. Normalizacion del conjunto de tasas (payload real de la API) ===');
const norm = normalizarTasas({
  bcv_usd: 894.8876,
  bcv_eur: BCV_EUR_API_ROTA,
  binance_usdt: BINANCE,
});
check('BCV EUR corregido en el conjunto', Math.abs(norm.tasas.bcv_eur - 1006) < 0.01, `valor: ${norm.tasas.bcv_eur}`);
check('BCV USD intacto', norm.tasas.bcv_usd === 894.8876);
check('Binance intacto', norm.tasas.binance_usdt === 1010);
check('Se registra la correccion', norm.correcciones.length === 1, norm.correcciones.join(' | '));
check('Ninguna tasa invalida', norm.invalidas.length === 0, norm.invalidas.join(', '));

console.log('\n=== 6. Conjunto con tasa totalmente rota ===');
const normRoto = normalizarTasas({
  bcv_usd: 0.894,
  bcv_eur: 1.006,
  binance_usdt: BINANCE,
});
check('USD roto se corrige a 894', Math.abs(normRoto.tasas.bcv_usd - 894) < 0.5, `valor: ${normRoto.tasas.bcv_usd}`);
check('EUR roto se corrige a 1006', Math.abs((normRoto.tasas.bcv_eur || 0) - 1006) < 0.5, `valor: ${normRoto.tasas.bcv_eur}`);

console.log('\n=== 7. Tasa activa corrupta (caso real: tasa_cambio = 1.006) ===');
const res = resolverTasaCalculo(1.006, { bcv_usd: BCV_USD, bcv_eur: BCV_EUR_REAL, binance_usdt: BINANCE });
check('La tasa activa corrupta se corrige a ~1006', Math.abs(res.tasa - 1006) < 0.5, `valor: ${res.tasa}`);
check('Se marca como valida', res.esValida === true);
check('Se informa la correccion', !!res.nota, res.nota || '');

console.log('\n=== 8. Tasa activa correcta (no se toca) ===');
const resOk = resolverTasaCalculo(1006.03, { bcv_usd: BCV_USD, bcv_eur: BCV_EUR_REAL, binance_usdt: BINANCE });
check('La tasa correcta se mantiene', resOk.tasa === 1006.03, `valor: ${resOk.tasa}`);
check('Sin notas', resOk.nota === null);

console.log('\n=== 9. Sin ninguna tasa valida ===');
const resSin = resolverTasaCalculo(1.006, {});
check('Se marca como invalida', resSin.esValida === false);
check('Avisa al usuario', !!resSin.nota, resSin.nota || '');

console.log('\n=== 10. Impacto en el Capital Total ===');
const saldoBs = 334828.68;
const tasaBuena = resolverTasaCalculo(1.006, { bcv_usd: BCV_USD, bcv_eur: BCV_EUR_REAL, binance_usdt: BINANCE });
console.log(`   Con la tasa rota (1.006 tal cual) : $${(saldoBs / 1.006).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
console.log(`   Con la tasa corregida (${tasaBuena.tasa})    : $${(saldoBs / tasaBuena.tasa).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
check('La tasa rota inflaba el total', (saldoBs / 1.006) > 300000);
check('La tasa corregida lo arregla', (saldoBs / tasaBuena.tasa) < 1000);

console.log(`\n${fallos === 0 ? '✅ Todas las verificaciones pasaron' : `❌ ${fallos} verificación(es) fallaron`}\n`);
process.exit(fallos === 0 ? 0 : 1);
