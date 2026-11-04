/**
 * Generador de iconos de la extensión Smartbits Sync.
 *
 * Toma el logo oficial de Smartbits (icons/logo-source.png) y produce los
 * tamaños requeridos por el manifest (16, 48 y 128 px) usando promediado de
 * área con alfa premultiplicado (evita bordes oscuros al escalar).
 *
 * Sin dependencias externas: solo `zlib` de Node.
 *
 * Uso:  node icons/generate_icons.js
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE = path.join(__dirname, 'logo-source.png');

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
 * Decodificación PNG (8 bit, RGBA o RGB, sin entrelazado)
 * ------------------------------------------------------------------ */

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePng(buffer) {
  const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== SIGNATURE[i]) throw new Error('Archivo no es un PNG válido');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`Solo se soporta profundidad 8 (encontrado ${bitDepth})`);
  if (interlace !== 0) throw new Error('PNG entrelazado no soportado');
  if (colorType !== 6 && colorType !== 2) {
    throw new Error(`Solo se soportan PNG RGB/RGBA (encontrado tipo ${colorType})`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);

  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      const value = line[x];
      let out;
      switch (filter) {
        case 0: out = value; break;
        case 1: out = value + a; break;
        case 2: out = value + b; break;
        case 3: out = value + ((a + b) >> 1); break;
        case 4: out = value + paeth(a, b, c); break;
        default: throw new Error(`Filtro PNG desconocido: ${filter}`);
      }
      cur[x] = out & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      if (channels === 4) {
        pixels[d] = cur[s];
        pixels[d + 1] = cur[s + 1];
        pixels[d + 2] = cur[s + 2];
        pixels[d + 3] = cur[s + 3];
      } else {
        pixels[d] = cur[s];
        pixels[d + 1] = cur[s + 1];
        pixels[d + 2] = cur[s + 2];
        pixels[d + 3] = 255;
      }
    }

    prev = cur;
  }

  return { width, height, data: pixels };
}

/* ------------------------------------------------------------------ *
 * Codificación PNG (RGBA, filtro 0)
 * ------------------------------------------------------------------ */

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return chunk;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Procesado de imagen
 * ------------------------------------------------------------------ */

/** Recorta el contenido visible (ignora el canal alfa). */
function cropToContent({ width, height, data }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) throw new Error('El logo de origen no tiene contenido visible');

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    const src = ((y + minY) * width + minX) * 4;
    data.copy(out, y * w * 4, src, src + w * 4);
  }

  return { width: w, height: h, data: out };
}

/** Reescala con promediado de área y alfa premultiplicado. */
function resizeArea(image, target) {
  const { width: sw, height: sh, data: src } = image;
  const out = Buffer.alloc(target * target * 4);
  const ratio = Math.min(target / sw, target / sh);
  const drawW = Math.max(1, Math.round(sw * ratio));
  const drawH = Math.max(1, Math.round(sh * ratio));
  const offsetX = Math.floor((target - drawW) / 2);
  const offsetY = Math.floor((target - drawH) / 2);

  for (let ty = 0; ty < target; ty++) {
    for (let tx = 0; tx < target; tx++) {
      const dx = tx - offsetX;
      const dy = ty - offsetY;

      if (dx < 0 || dy < 0 || dx >= drawW || dy >= drawH) continue;

      const x0 = Math.floor((dx * sw) / drawW);
      const x1 = Math.max(x0 + 1, Math.ceil(((dx + 1) * sw) / drawW));
      const y0 = Math.floor((dy * sh) / drawH);
      const y1 = Math.max(y0 + 1, Math.ceil(((dy + 1) * sh) / drawH));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sw + sx) * 4;
          const alpha = src[i + 3] / 255;
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += src[i + 3];
        }
      }

      const count = (x1 - x0) * (y1 - y0);
      const outIndex = (ty * target + tx) * 4;

      if (a > 0) {
        out[outIndex] = Math.round(r / (a / 255));
        out[outIndex + 1] = Math.round(g / (a / 255));
        out[outIndex + 2] = Math.round(b / (a / 255));
      }
      out[outIndex + 3] = Math.round(a / count);
    }
  }

  return { width: target, height: target, data: out };
}

/* ------------------------------------------------------------------ *
 * Ejecución
 * ------------------------------------------------------------------ */

if (!fs.existsSync(SOURCE)) {
  console.error(`No se encuentra el logo de origen: ${SOURCE}`);
  process.exit(1);
}

const source = cropToContent(decodePng(fs.readFileSync(SOURCE)));
console.log(`Logo de origen: ${source.width}x${source.height}px`);

for (const size of [16, 48, 128]) {
  const resized = resizeArea(source, size);
  const file = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(resized.width, resized.height, resized.data));
  console.log(`  icon${size}.png generado (${fs.statSync(file).size} bytes)`);
}

console.log('Iconos creados exitosamente en', __dirname);
