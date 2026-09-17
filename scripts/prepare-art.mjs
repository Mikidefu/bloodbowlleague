// Prepara le illustrazioni Midjourney per il sito.
// Uso: metti i file grezzi in art-src/ con i nomi di docs/MIDJOURNEY.md, poi `npm run art`.
// - "cutout": rimuove lo sfondo piatto (anche le zone chiuse, es. tra braccia e gambe), ritaglia e salva WebP trasparente
// - "photo": ridimensiona e salva JPG ottimizzato
import { readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art-src';
const OUT = 'public/art';

const JOBS = {
  'stadium': { type: 'photo', width: 2400 },
  'texture-parchment': { type: 'photo', width: 1600 },
  'logo': { type: 'cutout', height: 700 },
  'trivium': { type: 'cutout', height: 240 },
  'hero-player': { type: 'cutout', height: 1200 },
  'trophy': { type: 'cutout', height: 500 },
  'star-player': { type: 'cutout', height: 800 },
  'header-teams': { type: 'cutout', height: 700 },
  'header-schedule': { type: 'cutout', height: 700 },
  'header-match': { type: 'cutout', height: 700 },
  'header-standings': { type: 'cutout', height: 700 },
  'header-stats': { type: 'cutout', height: 700 },
  'header-skills': { type: 'cutout', height: 700 },
  'header-coaches': { type: 'cutout', height: 700 },
  'header-seasons': { type: 'cutout', height: 700 },
  'header-login': { type: 'cutout', height: 700 },
};

const TOLERANCE = Number(process.env.ART_TOLERANCE ?? 42);
// Zone chiuse rimosse solo se abbastanza grandi e dello stesso bianco dello sfondo esterno
// (i bianchi dipinti, es. strisce di una maglia, hanno tono diverso e più variazione)
const HOLE_MIN_AREA = Number(process.env.ART_HOLE_AREA ?? 0.0015);
const HOLE_MATCH = Number(process.env.ART_HOLE_MATCH ?? 4);
const HOLE_MAX_SD = Number(process.env.ART_HOLE_SD ?? 4.5);

async function removeBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;
  const px = (x, y) => (y * width + x) * 4;

  // Se gli angoli sono già trasparenti il file è già scontornato
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  if (corners.every(i => data[i + 3] < 10)) return sharp(data, { raw: info });

  const bg = [0, 1, 2].map(c => corners.reduce((sum, i) => sum + data[i + c], 0) / corners.length);
  const dist = new Float32Array(total);
  for (let n = 0; n < total; n++) {
    const i = n * 4;
    dist[n] = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  }

  // Bordo morbido: pixel quasi uguali allo sfondo diventano trasparenti, quelli al limite semitrasparenti
  const clear = n => {
    const d = dist[n];
    data[n * 4 + 3] = d < TOLERANCE * 0.6 ? 0 : Math.round(255 * ((d - TOLERANCE * 0.6) / (TOLERANCE * 0.4)));
  };

  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);

  // Raccoglie la regione di pixel "tipo sfondo" connessa a partire da seed
  const collect = (seeds, out) => {
    let top = 0;
    for (const s of seeds) if (!seen[s] && dist[s] <= TOLERANCE) { seen[s] = 1; stack[top++] = s; }
    let count = 0;
    let sum = 0;
    let sq = 0;
    while (top) {
      const n = stack[--top];
      out.push(n);
      count++;
      sum += dist[n];
      sq += dist[n] * dist[n];
      const x = n % width;
      const neighbours = [x > 0 ? n - 1 : -1, x < width - 1 ? n + 1 : -1, n - width, n + width];
      for (const m of neighbours) {
        if (m < 0 || m >= total || seen[m] || dist[m] > TOLERANCE) continue;
        seen[m] = 1;
        stack[top++] = m;
      }
    }
    const mean = count ? sum / count : 0;
    return { count, mean, sd: count ? Math.sqrt(Math.max(0, sq / count - mean * mean)) : 0 };
  };

  // 1) sfondo esterno collegato ai bordi
  const border = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) border.push(y * width, y * width + width - 1);
  const outside = [];
  const bgStats = collect(border, outside);
  outside.forEach(clear);

  // 2) zone chiuse grandi e uniformi (buchi tra braccia, gambe, manici)
  let holes = 0;
  const minArea = Math.max(200, Math.round(total * HOLE_MIN_AREA));
  for (let n = 0; n < total; n++) {
    if (seen[n] || dist[n] > TOLERANCE) continue;
    const region = [];
    const { count, mean, sd } = collect([n], region);
    if (count >= minArea && Math.abs(mean - bgStats.mean) <= HOLE_MATCH && sd <= HOLE_MAX_SD) {
      region.forEach(clear);
      holes++;
    }
  }

  return { image: sharp(data, { raw: info }), holes };
}

// Favicon da un'immagine trasparente: icon.png (512), apple-icon.png (180, fondo scuro) e favicon.ico (16/32/48)
async function writeFavicons(source) {
  const square = size => sharp(source)
    .trim({ threshold: 1 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(await square(512)).toFile('src/app/icon.png');
  await sharp(await square(160))
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: '#16191e' })
    .flatten({ background: '#16191e' })
    .png()
    .toFile('src/app/apple-icon.png');

  // ICO con immagini PNG incorporate
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(square));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((size, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return entry;
  });
  await writeFile('src/app/favicon.ico', Buffer.concat([header, ...entries, ...images]));
  console.log('  ↳ favicon aggiornate: src/app/favicon.ico, icon.png, apple-icon.png');
}

async function run() {
  await mkdir(OUT, { recursive: true });
  let files;
  try {
    files = await readdir(SRC);
  } catch {
    console.error(`Cartella ${SRC}/ non trovata: creala e mettici i file generati.`);
    process.exit(1);
  }

  let done = 0;
  for (const file of files) {
    const name = path.parse(file).name.toLowerCase();
    const job = JOBS[name];
    if (!job) {
      console.warn(`- salto ${file}: nome non riconosciuto`);
      continue;
    }
    const input = path.join(SRC, file);

    if (job.type === 'photo') {
      await sharp(input)
        .resize({ width: job.width, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(OUT, `${name}.jpg`));
      console.log(`✓ ${file} → ${OUT}/${name}.jpg`);
    } else {
      const result = await removeBackground(input);
      const image = 'image' in result ? result.image : result;
      const holes = 'holes' in result ? result.holes : 0;
      const cut = await image.png().toBuffer();
      await sharp(cut)
        .trim({ threshold: 1 })
        .resize({ height: job.height, withoutEnlargement: true })
        .webp({ quality: 86, alphaQuality: 90, effort: 5 })
        .toFile(path.join(OUT, `${name}.webp`));
      // Rimuove l'eventuale vecchia versione PNG
      await rm(path.join(OUT, `${name}.png`), { force: true });
      console.log(`✓ ${file} → ${OUT}/${name}.webp${holes ? ` (${holes} zone chiuse rimosse)` : ''}`);
      // Il logo diventa anche la favicon del sito
      if (name === 'logo') {
        await writeFavicons(cut);
      }
    }
    done++;
  }
  console.log(`\n${done} immagini pronte.`);
}

run();
