// Rasterizza le texture del sito: public/brand/grain.webp e grunge.webp
// Uso: npm run textures
//
// I sorgenti sono gli SVG con feTurbulence in public/brand. Usati direttamente come sfondo
// costringono il browser a ricalcolare il rumore a ogni ridisegno: su Android lo scroll va a scatti.
// Un'immagine già pronta viene decodificata una volta sola e poi solo ripetuta.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const DIR = 'public/brand';

// scale: pixel per unità SVG. La grana è fine e va a 2x per restare nitida sui telefoni;
// le macchie del grunge sono larghe e a 1x non si nota differenza.
const JOBS = [
  { name: 'grain', size: 240, scale: 2, quality: 60 },
  { name: 'grunge', size: 900, scale: 1, quality: 70 },
];

for (const { name, size, scale, quality } of JOBS) {
  const svg = await readFile(`${DIR}/${name}.svg`);
  const out = await sharp(svg, { density: 96 * scale })
    .resize(size * scale, size * scale)
    .webp({ quality, alphaQuality: quality, effort: 6 })
    .toBuffer();
  await writeFile(`${DIR}/${name}.webp`, out);
  console.log(`${name}.webp  ${size * scale}px  ${(out.length / 1024).toFixed(1)} kB`);
}
