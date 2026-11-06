import {
  parseDecimalInput,
  parseTasaInput,
  formatearDecimalInput,
} from '../src/utils/numeros.js';

let fallos = 0;

function check(nombre, condicion, detalle = '') {
  const estado = condicion ? '✅' : '❌';
  if (!condicion) fallos++;
  console.log(`${estado} ${nombre}${detalle ? ` -> ${detalle}` : ''}`);
}

console.log('\n=== 1. parseDecimalInput (montos) ===');
check('"1006,03" -> 1006.03', parseDecimalInput('1006,03') === 1006.03);
check('"1006.03" -> 1006.03', parseDecimalInput('1006.03') === 1006.03);
check('"1.006,03" -> 1006.03', parseDecimalInput('1.006,03') === 1006.03);
check('"1,006.03" -> 1006.03', parseDecimalInput('1,006.03') === 1006.03);
check('"1.006.000" -> 1006000', parseDecimalInput('1.006.000') === 1006000);
check('"1,006,000" -> 1006000', parseDecimalInput('1,006,000') === 1006000);
check('"1,006" (ambiguo) -> 1.006', parseDecimalInput('1,006') === 1.006);
check('"1.006" (ambiguo) -> 1.006', parseDecimalInput('1.006') === 1.006);
check('"150" -> 150', parseDecimalInput('150') === 150);
check('"" -> 0', parseDecimalInput('') === 0);
check('null -> 0', parseDecimalInput(null) === 0);
check('numero -> numero', parseDecimalInput(42.5) === 42.5);

console.log('\n=== 2. parseTasaInput (tasas) ===');
check('"1006,03" -> 1006.03', parseTasaInput('1006,03') === 1006.03);
check('"1006.03" -> 1006.03', parseTasaInput('1006.03') === 1006.03);
check('"1.006,03" -> 1006.03', parseTasaInput('1.006,03') === 1006.03);
check('"1.006" -> 1006 (miles, no 1.006)', parseTasaInput('1.006') === 1006);
check('"1,006" -> 1006 (miles)', parseTasaInput('1,006') === 1006);
check('"0.894" -> 894 (miles)', parseTasaInput('0.894') === 894);
check('"894.8876" -> 894.8876', parseTasaInput('894.8876') === 894.8876);
check('"1006" -> 1006', parseTasaInput('1006') === 1006);
check('"25" -> 25', parseTasaInput('25') === 25);
check('"" -> 0', parseTasaInput('') === 0);

console.log('\n=== 3. formatearDecimalInput (formato venezolano) ===');
check('1006.03 -> "1.006,03"', formatearDecimalInput(1006.03) === '1.006,03');
check('894.8876 -> "894,89"', formatearDecimalInput(894.8876) === '894,89');
check('1006 -> "1.006,00"', formatearDecimalInput(1006) === '1.006,00');
check('invalido -> ""', formatearDecimalInput('abc') === '');

console.log('\n=== 4. Ida y vuelta (lo que escribe el boton, lo que lee el programa) ===');
const valores = [1006, 1006.03, 894.8876, 1010.5, 100];
for (const v of valores) {
  const escrito = formatearDecimalInput(v);
  const leido = parseTasaInput(escrito);
  check(`"${escrito}" -> ${leido}`, Math.abs(leido - v) < 0.01, `esperado ${v}`);
}

console.log('\n=== 5. El valor que rompe el input type=number (punto decimal) ===');
const conPunto = '1006.03';
check(`"${conPunto}" se interpreta bien`, parseTasaInput(conPunto) === 1006.03);
check('"1.006,03" (formato venezolano) se interpreta bien', parseTasaInput('1.006,03') === 1006.03);

console.log(`\n${fallos === 0 ? '✅ Todas las verificaciones pasaron' : `❌ ${fallos} verificación(es) fallaron`}\n`);
process.exit(fallos === 0 ? 0 : 1);
