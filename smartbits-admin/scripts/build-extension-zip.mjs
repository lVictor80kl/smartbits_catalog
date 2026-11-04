/**
 * Empaqueta la extensión de Chrome en un .zip descargable.
 *
 * Por qué este script: el ZIP publicado anteriormente se había generado con
 * `zip -r` desde Linux, lo que produce entradas con prefijo "./" (incluida una
 * entrada raíz "./"). El extractor nativo de Windows (Explorer) no interpreta
 * ese formato y muestra el archivo como vacío / corrupto, aunque con 7-Zip o
 * .NET sí se abra bien.
 *
 * Este script escribe un ZIP estándar (spec PKWARE) con rutas relativas
 * limpias: `manifest.json`, `background.js`, `icons/icon48.png`, etc., de modo
 * que al extraer se obtiene la carpeta lista para "Cargar descomprimida".
 *
 * Uso:
 *   node scripts/build-extension-zip.mjs
 *
 * Opciones:
 *   --src <dir>    Carpeta de la extensión (por defecto se autodetecta)
 *   --out <file>   Archivo .zip de salida
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const EXTENSION_DIR_NAME = 'smartbits-ebay-extension';

/* ------------------------------------------------------------------ *
 * CRC32
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Helpers ZIP
 * ------------------------------------------------------------------ */

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

/** Lista recursivamente los archivos de una carpeta (rutas relativas con "/"). */
function listFiles(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, base, acc);
    } else if (entry.isFile()) {
      acc.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return acc;
}

/**
 * Construye un ZIP válido a partir de un mapa { rutaRelativa: Buffer }.
 * Rutas sin prefijo "./" y sin entrada de directorio raíz.
 */
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data, mtime } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const { time, date } = dosDateTime(mtime);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // firma
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // flags: nombre en UTF-8
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // sin extra field
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // firma
    central.writeUInt16LE(20, 4); // versión creador
    central.writeUInt16LE(20, 6); // versión necesaria
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentario
    central.writeUInt16LE(0, 34); // disco
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0o644 << 16, 38); // atributos externos (UNIX rw-r--r--)
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, compressed);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

/* ------------------------------------------------------------------ *
 * Resolución de rutas y ejecución
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { src: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') args.src = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

function findSourceDir(explicit) {
  if (explicit) return path.resolve(explicit);
  const candidates = [
    path.join(REPO_ROOT, EXTENSION_DIR_NAME),
    path.join(__dirname, '..', '..', EXTENSION_DIR_NAME),
    path.join(process.cwd(), EXTENSION_DIR_NAME),
    path.join(process.cwd(), '..', EXTENSION_DIR_NAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'manifest.json'))) return candidate;
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const srcDir = findSourceDir(args.src);
const outFile = path.resolve(
  args.out || path.join(__dirname, '..', 'public', `${EXTENSION_DIR_NAME}.zip`)
);

if (!srcDir) {
  console.warn(
    `[build-extension-zip] No se encontró la carpeta "${EXTENSION_DIR_NAME}". ` +
      'Se conserva el .zip existente en public/.'
  );
  process.exit(0);
}

const files = listFiles(srcDir).sort();
if (!files.includes('manifest.json')) {
  console.error(`[build-extension-zip] ${srcDir} no contiene manifest.json`);
  process.exit(1);
}

const entries = files.map((name) => {
  const full = path.join(srcDir, name);
  return { name, data: fs.readFileSync(full), mtime: fs.statSync(full).mtime };
});

const zip = buildZip(entries);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, zip);

console.log(`[build-extension-zip] ${entries.length} archivos -> ${path.relative(REPO_ROOT, outFile)} (${zip.length} bytes)`);
for (const { name } of entries) console.log(`  ${name}`);
