// Prepara le illustrazioni Midjourney per il sito.
// Uso: metti i file grezzi in art-src/ con i nomi di docs/MIDJOURNEY.md, poi `npm run art`.
// - "cutout": rimuove lo sfondo piatto partendo dai bordi, ritaglia e salva PNG trasparente
// - "photo": ridimensiona e salva JPG ottimizzato
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'art-src';
const OUT = 'public/art';

const JOBS = {
  'stadium': { type: 'photo', width: 2400 },
  'texture-parchment': { type: 'photo', width: 1600 },
  'logo-crest': { type: 'cutout', height: 900 },
  'hero-player': { type: 'cutout', height: 1400 },
  'trophy': { type: 'cutout', height: 700 },
  'star-player': { type: 'cutout', height: 1000 },
  'header-teams': { type: 'cutout', height: 800 },
  'header-schedule': { type: 'cutout', height: 800 },
  'header-match': { type: 'cutout', height: 800 },
  'header-standings': { type: 'cutout', height: 800 },
  'header-stats': { type: 'cutout', height: 800 },
  'header-skills': { type: 'cutout', height: 800 },
  'header-coaches': { type: 'cutout', height: 800 },
  'header-seasons': { type: 'cutout', height: 800 },
  'header-login': { type: 'cutout', height: 800 },
};

const TOLERANCE = Number(process.env.ART_TOLERANCE ?? 42);

// Flood fill dai bordi: rende trasparenti i pixel simili al colore di sfondo e connessi al bordo
async function removeBackground(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = (x, y) => (y * width + x) * 4;

  // Se gli angoli sono già trasparenti il file è già scontornato
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  if (corners.every(i => data[i + 3] < 10)) return sharp(data, { raw: info });

  const bg = [0, 1, 2].map(c => corners.reduce((sum, i) => sum + data[i + c], 0) / corners.length);
  const dist = i => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) stack.push(0, y, width - 1, y);

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const n = y * width + x;
    if (visited[n]) continue;
    visited[n] = 1;
    const i = n * 4;
    const d = dist(i);
    if (d > TOLERANCE) continue;
    // Bordo morbido: pixel quasi uguali allo sfondo diventano trasparenti, quelli al limite semitrasparenti
    data[i + 3] = d < TOLERANCE * 0.6 ? 0 : Math.round(255 * ((d - TOLERANCE * 0.6) / (TOLERANCE * 0.4)));
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return sharp(data, { raw: info });
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
    } else {
      const cut = await removeBackground(input);
      const trimmed = await cut.png().toBuffer();
      await sharp(trimmed)
        .trim({ threshold: 1 })
        .resize({ height: job.height, withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: false })
        .toFile(path.join(OUT, `${name}.png`));
    }
    done++;
    console.log(`✓ ${file} → ${OUT}/${name}.${job.type === 'photo' ? 'jpg' : 'png'}`);
  }
  console.log(`\n${done} immagini pronte.`);
}

run();
