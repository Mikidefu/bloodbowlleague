// Genera le immagini dei dadi per il tutorial: public/tutorial/dice/*.webp
// Uso: npm run dice
//
// Sono disegni nostri, renderizzati in raster con sharp: nel tutorial vogliamo dadi
// "fotografici" e non diagrammi vettoriali. Le facce del dado da blocco seguono i
// cinque risultati del Rulebook 2025 (p. 62); i simboli sono ridisegnati da noi.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/tutorial/dice';
const SIZE = 440;          // lato del render sorgente
const BOX = 300;           // lato del dado dentro il render

// --- Palette (le stesse variabili di globals.css, qui in esadecimale) -------
const RED_LIGHT = '#e0453c';
const RED = '#b8222a';
const RED_DARK = '#7a1a1c';
const RED_EDGE = '#5d1214';
const SLATE_LIGHT = '#3c424c';
const SLATE = '#22262d';
const SLATE_DARK = '#14171c';
const BONE = '#f4ecd9';
const BONE_SHADE = '#cfc3a6';
const INK = '#1d1a18';

// Sfondo/luci comuni a tutti i dadi
const defs = (id, top, mid, bottom, edge) => `
  <defs>
    <linearGradient id="face-${id}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="0.55" stop-color="${mid}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <linearGradient id="side-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bottom}"/>
      <stop offset="1" stop-color="${edge}"/>
    </linearGradient>
    <radialGradient id="gloss-${id}" cx="0.3" cy="0.22" r="0.55">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shadow-${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#120b06" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#120b06" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>`;

const contactShadow = id => `
  <ellipse cx="${SIZE / 2}" cy="${SIZE - 54}" rx="${BOX * 0.56}" ry="30" fill="url(#shadow-${id})"/>`;

// Cubo visto leggermente di tre quarti: faccia frontale + estrusione a destra e in basso
function cube(id, symbol) {
  const x = (SIZE - BOX) / 2 - 10;
  const y = (SIZE - BOX) / 2 - 18;
  const r = 34;
  const d = 30;   // profondita' dell'estrusione
  return `
  ${contactShadow(id)}
  <g>
    <rect x="${x + d}" y="${y + d}" width="${BOX}" height="${BOX}" rx="${r}" fill="url(#side-${id})"/>
    <polygon points="${x + BOX} ${y + r} ${x + BOX + d} ${y + r + d} ${x + BOX + d} ${y + BOX + d - r} ${x + BOX} ${y + BOX - r}" fill="url(#side-${id})"/>
    <polygon points="${x + r} ${y + BOX} ${x + BOX - r} ${y + BOX} ${x + BOX - r + d} ${y + BOX + d} ${x + r + d} ${y + BOX + d}" fill="url(#side-${id})"/>
    <path d="M ${x + BOX - r} ${y + BOX} a ${r} ${r} 0 0 0 ${r} -${r} l ${d} ${d} a ${r} ${r} 0 0 1 -${r} ${r} z" fill="url(#side-${id})"/>
    <path d="M ${x + BOX - r} ${y} a ${r} ${r} 0 0 1 ${r} ${r} l ${d} ${d} a ${r} ${r} 0 0 0 -${r} -${r} z" fill="url(#side-${id})"/>
    <path d="M ${x} ${y + BOX - r} a ${r} ${r} 0 0 0 ${r} ${r} l ${d} ${d} a ${r} ${r} 0 0 1 -${r} -${r} z" fill="url(#side-${id})"/>
    <rect x="${x}" y="${y}" width="${BOX}" height="${BOX}" rx="${r}" fill="url(#face-${id})"/>
    <rect x="${x}" y="${y}" width="${BOX}" height="${BOX}" rx="${r}" fill="url(#gloss-${id})"/>
    <rect x="${x + 5}" y="${y + 5}" width="${BOX - 10}" height="${BOX - 10}" rx="${r - 5}" fill="none" stroke="url(#rim-${id})" stroke-width="6"/>
    <g transform="translate(${x + BOX / 2} ${y + BOX / 2})">${symbol}</g>
  </g>`;
}

// --- Simboli del dado da blocco (ridisegnati seguendo i cinque risultati di p. 62) ---
// Player Down: teschio · Both Down: teschio dentro lo scontro · Push Back: freccia
// Stumble: freccia con il punto esclamativo sullo scoppio · POW: solo lo scoppio.

const skull = (s = 1, tx = 0, ty = 0, hollow = RED_EDGE, fill = BONE) => `
  <g transform="translate(${tx} ${ty}) scale(${s})" fill="${fill}">
    <path d="M0 -46 c-30 0 -52 22 -52 50 0 17 8 30 19 38 l2 20 c0 7 6 12 13 12 h36 c7 0 13 -5 13 -12 l2 -20 c11 -8 19 -21 19 -38 0 -28 -22 -50 -52 -50 z"/>
    <ellipse cx="-19" cy="4" rx="12" ry="14" fill="${hollow}"/>
    <ellipse cx="19" cy="4" rx="12" ry="14" fill="${hollow}"/>
    <path d="M-6 28 l6 -14 6 14 z" fill="${hollow}"/>
    <rect x="-16" y="46" width="8" height="14" rx="2" fill="${hollow}"/>
    <rect x="-4" y="46" width="8" height="14" rx="2" fill="${hollow}"/>
    <rect x="8" y="46" width="8" height="14" rx="2" fill="${hollow}"/>
  </g>`;

// Scoppio a punte irregolari: e' l'impatto, lo stesso segno che sul dado vero
// sta dietro a Both Down e Stumble e da solo vale POW.
const burst = (s = 1, fill = BONE, spikes = 11) => {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2;
    const rr = i % 2 === 0 ? 82 : 42;
    const jitter = i % 4 === 0 ? 0.92 : 1;
    pts.push(`${(Math.cos(a) * rr * jitter).toFixed(1)},${(Math.sin(a) * rr * jitter).toFixed(1)}`);
  }
  return `<polygon transform="scale(${s})" points="${pts.join(' ')}" fill="${fill}"/>`;
};

const arrow = (rot = -40, s = 1, tx = 0, ty = 0, fill = BONE) => `
  <g transform="translate(${tx} ${ty}) rotate(${rot}) scale(${s})" fill="${fill}">
    <path d="M0 -84 l56 62 h-30 v64 h-52 v-64 h-30 z"/>
  </g>`;

const bang = (tx, ty, s = 1, fill = BONE) => `
  <g transform="translate(${tx} ${ty}) scale(${s})" fill="${fill}">
    <path d="M-10 -42 h20 l-4 50 h-12 z"/>
    <circle cx="0" cy="22" r="11"/>
  </g>`;

// Contorno rosso sotto il simbolo bianco: cosi' il segno si stacca dallo scoppio
const outlined = (shape, scale) => `${shape(RED, scale)}${shape(BONE, 1)}`;

const skullShape = (fill, s) => skull(0.92 * s, 0, 2, fill === BONE ? RED : fill, fill);
const arrowShape = (fill, s) => arrow(-40, 0.82 * s, -16, -8, fill);
const bangShape = (fill, s) => bang(50, 38, 1.1 * s, fill);

const BLOCK_FACES = {
  // cadi tu: il teschio e basta
  'block-player-down': skull(1),
  // cadete tutti e due: il teschio nello scoppio
  'block-both-down': `${burst(1.25)}${outlined(skullShape, 1.12)}`,
  // lo spingi: freccia piena
  'block-push-back': arrow(-40, 1),
  // stumble: freccia e punto esclamativo sullo scoppio
  'block-stumble': `${burst(1.1, 'rgba(246,242,234,0.3)')}${arrowShape(BONE, 1)}${bangShape(BONE, 1)}`,
  // POW: solo lo scoppio
  'block-pow': burst(1.28),
};

// --- Dadi numerici ----------------------------------------------------------
const pip = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="17" fill="${BONE}"/>
  <circle cx="${cx - 4}" cy="${cy - 5}" r="6" fill="#ffffff" opacity="0.5"/>`;

// faccia del 4: quattro pip agli angoli (è il risultato che usiamo come esempio "4+")
const d6Face = [pip(-58, -58), pip(58, -58), pip(-58, 58), pip(58, 58)].join('');

// Dado a più facce: silhouette a bipiramide con faccette e numero al centro
function polyDie(id, faces, label) {
  const cx = SIZE / 2;
  const cy = SIZE / 2 - 12;
  const R = BOX * 0.55;
  const w = R * 0.95;            // semi-larghezza all'equatore
  const k = faces === 8 ? 2 : 4; // faccette per meta'
  const facet = [];
  for (let i = 0; i < k; i++) {
    const x0 = cx - w + ((2 * w) / k) * i;
    const x1 = x0 + (2 * w) / k;
    // meta' superiore
    facet.push(`<polygon points="${x0},${cy + R * 0.14} ${x1},${cy + R * 0.14} ${cx},${cy - R}"
      fill="${i % 2 ? SLATE : SLATE_LIGHT}" stroke="#0b0d11" stroke-width="1.5"/>`);
    // meta' inferiore, piu' scura
    facet.push(`<polygon points="${x0},${cy + R * 0.14} ${x1},${cy + R * 0.14} ${cx},${cy + R}"
      fill="${i % 2 ? SLATE_DARK : SLATE}" stroke="#0b0d11" stroke-width="1.5"/>`);
  }
  return `
  ${contactShadow(id)}
  <g>
    <polygon points="${cx},${cy - R} ${cx + w},${cy + R * 0.14} ${cx},${cy + R} ${cx - w},${cy + R * 0.14}"
             fill="url(#face-${id})" stroke="#0b0d11" stroke-width="3"/>
    ${facet.join('')}
    <polygon points="${cx},${cy - R} ${cx + w},${cy + R * 0.14} ${cx},${cy + R} ${cx - w},${cy + R * 0.14}"
             fill="url(#gloss-${id})"/>
    <text x="${cx}" y="${cy + R * 0.02}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
          font-size="${faces === 8 ? 88 : 74}" font-weight="900" fill="${BONE}"
          stroke="#0b0d11" stroke-width="3" paint-order="stroke">${label}</text>
  </g>`;
}

function svg(id, body, top, mid, bottom, edge) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    ${defs(id, top, mid, bottom, edge)}
    ${body}
  </svg>`;
}

const JOBS = [];

for (const [name, symbol] of Object.entries(BLOCK_FACES)) {
  JOBS.push([name, svg(name, cube(name, symbol), RED_LIGHT, RED, RED_DARK, RED_EDGE)]);
}

JOBS.push(['d6', svg('d6', cube('d6', d6Face), SLATE_LIGHT, SLATE, SLATE_DARK, '#0b0d11')]);
JOBS.push(['d8', svg('d8', polyDie('d8', 8, '7'), SLATE_LIGHT, SLATE, SLATE_DARK, '#0b0d11')]);
JOBS.push(['d16', svg('d16', polyDie('d16', 16, '11'), SLATE_LIGHT, SLATE, SLATE_DARK, '#0b0d11')]);

await mkdir(OUT, { recursive: true });

for (const [name, markup] of JOBS) {
  const file = `${OUT}/${name}.webp`;
  await sharp(Buffer.from(markup)).resize(SIZE, SIZE).webp({ quality: 92 }).toFile(file);
  console.log('→', file);
}

// Foglio di contatto: i cinque risultati affiancati (per la home e le anteprime)
const strip = 5 * 300;
const parts = await Promise.all(
    Object.keys(BLOCK_FACES).map(async (name, i) => ({
      input: await sharp(Buffer.from(JOBS[i][1])).resize(300, 300).png().toBuffer(),
      left: i * 300,
      top: 0,
    })),
);
await sharp({ create: { width: strip, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts)
    .webp({ quality: 92 })
    .toFile(`${OUT}/block-all.webp`);
console.log('→', `${OUT}/block-all.webp`);

await writeFile(`${OUT}/README.md`,
    '# Dadi\n\nImmagini generate da `npm run dice` (vedi scripts/make-dice.mjs).\n' +
    'Sono disegni nostri: i risultati seguono il Rulebook 2025 p. 62, i simboli sono ridisegnati.\n');
