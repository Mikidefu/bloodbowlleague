'use client';
import React, { useId, useState } from 'react';
import type { Lang } from '@/lib/tutorial';
import { useInView } from './useInView';
import styles from './TutorialDiagram.module.css';

// Diagrammi del tutorial: disegni nostri, nessuna immagine del manuale.
// Tutti condividono la stessa "tavola" (viewBox 360x230) con testata rossa,
// così nel lettore le figure hanno sempre lo stesso ingombro e lo stesso stile.
// I dadi veri e propri non stanno qui: sono immagini in public/tutorial/dice/.

const W = 360;
const H = 230;
const HEAD = 26;               // altezza della testata

const t = (lang: Lang, it: string, en: string) => (lang === 'it' ? it : en);

// --- ritmo delle scene ----------------------------------------------------------
// `at` dice quando un elemento entra, `slideTo` di quanto si sposta. Il tempo sta
// nel JSX accanto alla cosa che si muove, non sparso nel CSS.
const at = (d: number) => ({ '--d': `${d}s` }) as React.CSSProperties;
const slideTo = (d: number, dx: number, dy = 0) =>
    ({ '--d': `${d}s`, '--dx': `${dx}px`, '--dy': `${dy}px` }) as React.CSSProperties;

type Props = { id?: string; lang: Lang };

// --- primitive ------------------------------------------------------------------

/** Tavola: carta, cornice, testata rossa con il titolo della figura.
 *  Con `animated` la scena si anima una volta sola, la prima volta che la figura
 *  entra in campo; il pulsante "rivedi" la fa ripartire da capo. */
function Plate({ label, animated, lang, children }: {
  label: string; animated?: boolean; lang?: Lang; children: React.ReactNode;
}) {
  const { ref, seen } = useInView<HTMLElement>();
  const [run, setRun] = useState(0);
  const playing = Boolean(animated) && seen;

  return (
      <figure ref={ref} className={`${styles.figure} ${playing ? styles.play : ''}`}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={label}>
          <rect x="0" y="0" width={W} height={H} className={styles.paper} />
          <rect x="0" y="0" width={W} height={HEAD} className={styles.head} />
          <text x="12" y={HEAD - 8} className={styles.headText}>{label}</text>
          <path d={`M ${W - 26} 0 L ${W} 0 L ${W} ${HEAD} Z`} className={styles.headCorner} />
          {/* il key rimonta la scena: e' il modo piu' affidabile di far ripartire le animazioni CSS */}
          <g key={run} transform={`translate(0 ${HEAD})`}>{children}</g>
          <rect x="1" y="1" width={W - 2} height={H - 2} className={styles.frame} />
        </svg>
        {animated && (
            <button
                type="button"
                className={styles.replay}
                onClick={() => setRun(r => r + 1)}
                aria-label={t(lang ?? 'it', "Rivedi l’animazione", "Replay the animation")}
            >
              &#8635;
            </button>
        )}
      </figure>
  );
}

/** Erba a strisce con gessetti: la base di ogni figura sul campo. */
function Pitch({ x, y, w, h, cols, rows }: { x: number; y: number; w: number; h: number; cols: number; rows: number }) {
  const cw = w / cols;
  const ch = h / rows;
  return (
      <g>
        {Array.from({ length: cols }, (_, i) => (
            <rect key={i} x={x + i * cw} y={y} width={cw} height={h} className={i % 2 ? styles.turfB : styles.turfA} />
        ))}
        <g className={styles.chalk}>
          {Array.from({ length: cols - 1 }, (_, i) => (
              <line key={`v${i}`} x1={x + (i + 1) * cw} y1={y} x2={x + (i + 1) * cw} y2={y + h} />
          ))}
          {Array.from({ length: rows - 1 }, (_, i) => (
              <line key={`h${i}`} x1={x} y1={y + (i + 1) * ch} x2={x + w} y2={y + (i + 1) * ch} />
          ))}
        </g>
        <rect x={x} y={y} width={w} height={h} className={styles.pitchEdge} />
      </g>
  );
}

/** Pedina vista dall'alto: base tonda con anello, come i segnalini sul tavolo. */
function Token({ cx, cy, r = 9, side = 'home', label, ghost }: {
  cx: number; cy: number; r?: number; side?: 'home' | 'away' | 'ball'; label?: string; ghost?: boolean;
}) {
  const cls = side === 'home' ? styles.tokenHome : side === 'away' ? styles.tokenAway : styles.tokenBall;
  return (
      <g opacity={ghost ? 0.45 : 1}>
        <ellipse cx={cx} cy={cy + r * 0.55} rx={r * 0.95} ry={r * 0.35} className={styles.tokenShadow} />
        <circle cx={cx} cy={cy} r={r} className={cls} />
        <circle cx={cx} cy={cy} r={r - 2.5} className={styles.tokenInner} />
        <path d={`M ${cx - r * 0.55} ${cy - r * 0.15} a ${r * 0.55} ${r * 0.62} 0 0 1 ${r * 1.1} 0 z`} className={styles.tokenHelmet} />
        {label && <text x={cx} y={cy + r * 0.62} className={styles.tokenLabel}>{label}</text>}
      </g>
  );
}

/** Palla ovale con le cuciture. */
function Ball({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
      <g transform={`translate(${cx} ${cy}) scale(${s})`}>
        <ellipse cx="0" cy="0" rx="6" ry="4" className={styles.ball} />
        <line x1="-3.4" y1="0" x2="3.4" y2="0" className={styles.ballSeam} />
        <line x1="-1.6" y1="-1.6" x2="-1.6" y2="1.6" className={styles.ballSeam} />
        <line x1="0" y1="-2" x2="0" y2="2" className={styles.ballSeam} />
        <line x1="1.6" y1="-1.6" x2="1.6" y2="1.6" className={styles.ballSeam} />
      </g>
  );
}

/** Spezza il testo su piu' righe: il viewBox e' fisso, le frasi no. */
function wrap(text: string, maxChars: number, maxLines = 2): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line && lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Riga di tabella "da regolamento": pasticca a sinistra, testo a destra. */
function Row({ y, badge, text, note, tone = 'navy', x = 14, w = W - 28 }: {
  y: number; badge: string; text: string; note?: string; tone?: 'navy' | 'red' | 'green' | 'gold'; x?: number; w?: number;
}) {
  const badgeCls = tone === 'red' ? styles.badgeRed : tone === 'green' ? styles.badgeGreen : tone === 'gold' ? styles.badgeGold : styles.badgeNavy;
  const textX = x + 56;
  const room = w - 62;
  const lines = wrap(text, Math.floor(room / 4.8), note ? 1 : 2);
  const noteLines = note ? wrap(note, Math.floor(room / 4.1), 1) : [];
  const h = note ? 30 : 26;
  return (
      <g>
        <rect x={x} y={y} width={w} height={h} className={styles.rowBg} />
        <rect x={x + 5} y={y + (h - 18) / 2} width="42" height="18" rx="2" className={badgeCls} />
        <text x={x + 26} y={y + h / 2 + 4} className={styles.badgeText}>{badge}</text>
        {note ? (
            <>
              <text x={textX} y={y + 13} className={styles.body}>{lines[0]}</text>
              <text x={textX} y={y + 24} className={styles.caption}>{noteLines[0]}</text>
            </>
        ) : lines.length > 1 ? (
            <>
              <text x={textX} y={y + 11} className={styles.body}>{lines[0]}</text>
              <text x={textX} y={y + 21} className={styles.body}>{lines[1]}</text>
            </>
        ) : (
            <text x={textX} y={y + 17} className={styles.body}>{lines[0]}</text>
        )}
      </g>
  );
}

/** Freccia con punta: usa un marker unico per istanza. */
function Arrow({ d, mid, tone = 'red' }: { d: string; mid?: string; tone?: 'red' | 'navy' }) {
  const id = useId().replace(/:/g, '');
  const cls = tone === 'navy' ? styles.arrowNavy : styles.arrowRed;
  return (
      <g>
        <defs>
          <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className={cls} />
          </marker>
        </defs>
        <path d={d} className={`${styles.arrowLine} ${cls}`} markerEnd={`url(#${id})`} />
        {mid && <text className={styles.arrowLabel}>{mid}</text>}
      </g>
  );
}

/** Pasticca con numero/etichetta corta. */
function Chip({ x, y, w = 78, h = 22, text, tone = 'navy' }: {
  x: number; y: number; w?: number; h?: number; text: string; tone?: 'navy' | 'red' | 'green' | 'gold' | 'paper';
}) {
  const cls = tone === 'red' ? styles.chipRed : tone === 'green' ? styles.chipGreen
      : tone === 'gold' ? styles.chipGold : tone === 'paper' ? styles.chipPaper : styles.chipNavy;
  return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx="2" className={cls} />
        <text x={x + w / 2} y={y + h / 2 + 3.5} className={tone === 'paper' || tone === 'gold' ? styles.chipTextDark : styles.chipText}>{text}</text>
      </g>
  );
}

/** Facciata di dado da blocco in miniatura (per contare i dadi, non per spiegarli). */
function MiniDie({ x, y, s = 16, theirs = false }: { x: number; y: number; s?: number; theirs?: boolean }) {
  return (
      <g transform={`translate(${x} ${y})`}>
        <rect x="0" y="0" width={s} height={s} rx="3" className={theirs ? styles.miniDieAlt : styles.miniDie} />
        <circle cx={s / 2} cy={s * 0.42} r={s * 0.16} className={styles.miniDieMark} />
        <rect x={s * 0.3} y={s * 0.6} width={s * 0.4} height={s * 0.12} rx="1" className={styles.miniDieMark} />
      </g>
  );
}

const Note = ({ x, y, children, anchor = 'start', width = W - 28 }: {
  x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; width?: number;
}) => (
    <>
      {wrap(children, Math.floor(width / 4.1), 2).map((line, i) => (
          <text key={i} x={x} y={y + i * 11} textAnchor={anchor} className={styles.caption}>{line}</text>
      ))}
    </>
);

const Label = ({ x, y, children, anchor = 'start', width = W - 28 }: {
  x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; width?: number;
}) => (
    <>
      {wrap(children, Math.floor(width / 4.8), 2).map((line, i) => (
          <text key={i} x={x} y={y + i * 12} textAnchor={anchor} className={styles.body}>{line}</text>
      ))}
    </>
);

// --- diagrammi ------------------------------------------------------------------

function PitchDiagram({ lang }: { lang: Lang }) {
  const x = 30, y = 34, w = 300, h = 130, cols = 26, rows = 15;
  const cw = w / cols;
  const ch = h / rows;
  return (
      <Plate label={t(lang, 'IL CAMPO: 26 × 15 CASELLE', 'THE PITCH: 26 × 15 SQUARES')}>
        <Pitch x={x} y={y} w={w} h={h} cols={cols} rows={rows} />

        {/* End Zone */}
        <rect x={x} y={y} width={cw} height={h} className={styles.endzone} />
        <rect x={x + w - cw} y={y} width={cw} height={h} className={styles.endzone} />

        {/* Wide Zone */}
        <rect x={x + cw} y={y} width={w - 2 * cw} height={ch * 4} className={styles.wide} />
        <rect x={x + cw} y={y + h - ch * 4} width={w - 2 * cw} height={ch * 4} className={styles.wide} />
        <g className={styles.wideEdge}>
          <line x1={x + cw} y1={y + ch * 4} x2={x + w - cw} y2={y + ch * 4} />
          <line x1={x + cw} y1={y + h - ch * 4} x2={x + w - cw} y2={y + h - ch * 4} />
        </g>

        {/* Line of Scrimmage */}
        <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} className={styles.scrimmage} />

        <Ball cx={x + w / 2} cy={y + h / 2} s={0.8} />
        <Token cx={x + w / 2 - cw * 1.5} cy={y + h / 2} r={5} side="home" />
        <Token cx={x + w / 2 + cw * 1.5} cy={y + h / 2} r={5} side="away" />

        <text x={x + cw / 2} y={y + h / 2} className={styles.vLabel} transform={`rotate(-90 ${x + cw / 2} ${y + h / 2})`}>END ZONE</text>
        <text x={x + w - cw / 2} y={y + h / 2} className={styles.vLabel} transform={`rotate(-90 ${x + w - cw / 2} ${y + h / 2})`}>END ZONE</text>
        <Label x={x + w / 2} y={y + ch * 2.5} anchor="middle">WIDE ZONE</Label>
        <Label x={x + w / 2} y={y + h - ch * 1.8} anchor="middle">WIDE ZONE</Label>
        <Note x={x + w / 2 - 44} y={y + h / 2 - ch * 2} anchor="end">{t(lang, 'CENTRE FIELD', 'CENTRE FIELD')}</Note>
        <Note x={x + w / 2 + 4} y={y - 8}>{t(lang, 'LINE OF SCRIMMAGE', 'LINE OF SCRIMMAGE')}</Note>
        <Note x={x} y={y + h + 14}>{t(lang, 'SIDELINE — oltre il bordo c\'è il pubblico', 'SIDELINE — past the edge lies the crowd')}</Note>
        <Note x={x + w} y={y + h + 14} anchor="end">{t(lang, '8 caselle a testa per tempo', '8 turns each per half')}</Note>
      </Plate>
  );
}

function Profile({ lang }: { lang: Lang }) {
  const stats: [string, string, string][] = [
    ['MA', '6', t(lang, 'caselle', 'squares')],
    ['ST', '3', t(lang, 'forza', 'strength')],
    ['AG', '3+', t(lang, 'agilità', 'agility')],
    ['PA', '4+', t(lang, 'passaggio', 'passing')],
    ['AV', '9+', t(lang, 'armatura', 'armour')],
  ];
  return (
      <Plate label={t(lang, 'IL PROFILO DEL GIOCATORE', 'THE PLAYER PROFILE')}>
        <rect x="14" y="10" width={W - 28} height="34" className={styles.cardHead} />
        <Token cx={32} cy={27} r={12} side="home" label="1" />
        <text x="52" y="25" className={styles.name}>LINEMAN</text>
        <text x="52" y="37" className={styles.captionLight}>{t(lang, 'Human Team · 50.000', 'Human Team · 50,000')}</text>

        {stats.map(([k, v, note], i) => {
          const bx = 14 + i * 67;
          return (
              <g key={k}>
                <rect x={bx} y="52" width="62" height="62" className={styles.statBox} />
                <rect x={bx} y="52" width="62" height="16" className={styles.statHead} />
                <text x={bx + 31} y="64" className={styles.statKey}>{k}</text>
                <text x={bx + 31} y="94" className={styles.statValue}>{v}</text>
                <text x={bx + 31} y="108" className={styles.statNote}>{note}</text>
              </g>
          );
        })}

        <Row y={124} badge="3+" tone="green" text={t(lang, 'AG, PA e AV sono numeri bersaglio: tiri un D6 e vuoi almeno quello.', 'AG, PA and AV are target numbers: roll a D6 and you want at least that.')} />
        <Row y={154} badge="MA" tone="navy" text={t(lang, 'MA sono le caselle di movimento; oltre quelle puoi tentare un Rush.', 'MA is your movement in squares; beyond it you may attempt a Rush.')} />
      </Plate>
  );
}

function TargetNumber({ lang }: { lang: Lang }) {
  return (
      <Plate label={t(lang, 'NUMERI BERSAGLIO E TIRI NATURALI', 'TARGET NUMBERS AND NATURAL ROLLS')}>
        <Label x={14} y={20}>{t(lang, 'Esempio: test con bersaglio 4+', 'Example: a 4+ target roll')}</Label>
        {[1, 2, 3, 4, 5, 6].map((n, i) => {
          const bx = 14 + i * 55;
          const ok = n >= 4;
          return (
              <g key={n}>
                <rect x={bx} y="28" width="48" height="44" rx="4" className={ok ? styles.faceOk : styles.faceNo} />
                <text x={bx + 24} y="60" className={ok ? styles.faceNumOk : styles.faceNumNo}>{n}</text>
              </g>
          );
        })}
        <path d="M 14 78 H 178" className={styles.braceNo} />
        <path d="M 179 78 H 344" className={styles.braceOk} />
        <Note x={96} y={90} anchor="middle">{t(lang, 'fallito', 'failed')}</Note>
        <Note x={261} y={90} anchor="middle">{t(lang, 'riuscito', 'passed')}</Note>

        <Row y={104} badge="1" tone="red" text={t(lang, 'Un 1 naturale fallisce sempre, anche con tutti i bonus del mondo.', 'A natural 1 always fails, whatever the modifiers.')} />
        <Row y={134} badge="6" tone="green" text={t(lang, 'Un 6 naturale riesce sempre, anche quando sembra impossibile.', 'A natural 6 always succeeds, even when it looks impossible.')} />
        <Row y={164} badge="RR" tone="gold" text={t(lang, 'Il secondo tiro va tenuto, anche se è peggiore del primo.', 'You must keep the second roll, even when it is worse.')} />
      </Plate>
  );
}

function TurnStructure({ lang }: { lang: Lang }) {
  return (
      <Plate label={t(lang, 'DUE TEMPI DA OTTO ROUND', 'TWO HALVES OF EIGHT ROUNDS')}>
        {[0, 1].map(half => (
            <g key={half}>
              <rect x="14" y={14 + half * 76} width="64" height="44" className={styles.halfBox} />
              <text x="46" y={34 + half * 76} className={styles.halfNum}>{half + 1}º</text>
              <text x="46" y={48 + half * 76} className={styles.halfLabel}>{t(lang, 'TEMPO', 'HALF')}</text>
              {Array.from({ length: 8 }, (_, i) => {
                const bx = 86 + i * 33;
                return (
                    <g key={i}>
                      <rect x={bx} y={14 + half * 76} width="29" height="44" className={styles.roundBox} />
                      <text x={bx + 14.5} y={26 + half * 76} className={styles.roundNum}>{i + 1}</text>
                      <rect x={bx + 3} y={30 + half * 76} width="23" height="10" className={styles.turnA} />
                      <text x={bx + 14.5} y={38 + half * 76} className={styles.turnLabel}>A</text>
                      <rect x={bx + 3} y={42 + half * 76} width="23" height="10" className={styles.turnB} />
                      <text x={bx + 14.5} y={50 + half * 76} className={styles.turnLabel}>B</text>
                    </g>
                );
              })}
            </g>
        ))}
        <line x1="14" y1="68" x2={W - 14} y2="68" className={styles.halfTime} />
        <text x="86" y="64" className={styles.captionStrong}>{t(lang, 'INTERVALLO: i Team Re-roll tornano pieni', 'HALF TIME: Team Re-rolls come back')}</text>
        <Row y={168} badge="KO" tone="gold" text={t(lang, 'Nel 2º tempo calcia chi ha ricevuto nel 1º; dopo ogni TD si ricalcia.', 'In the second half the receivers kick off; after each TD there is a new kick-off.')} />
      </Plate>
  );
}

function Actions({ lang }: { lang: Lang }) {
  const once = ['Blitz', t(lang, 'Passaggio', 'Pass'), 'Hand-off', t(lang, 'Fallo', 'Foul'), 'Secure the Ball', 'Throw Team-mate'];
  return (
      <Plate label={t(lang, 'UN GIOCATORE, UN\'AZIONE', 'ONE PLAYER, ONE ACTION')}>
        <rect x="14" y="10" width="216" height="118" className={styles.panelRed} />
        <text x="22" y="26" className={styles.panelTitleDark}>{t(lang, 'UNA SOLA VOLTA PER TURNO', 'ONCE PER TEAM TURN')}</text>
        {once.map((a, i) => (
            <Chip key={a} x={22 + (i % 2) * 104} y={34 + Math.floor(i / 2) * 30} w={98} h={24} text={a} tone="paper" />
        ))}

        <rect x="238" y="10" width="108" height="118" className={styles.panelGreen} />
        <text x="246" y="26" className={styles.panelTitleGreen}>{t(lang, 'SENZA LIMITE', 'NO LIMIT')}</text>
        <Chip x={246} y={34} w={92} h={24} text={t(lang, 'Movimento', 'Move')} tone="green" />
        <Chip x={246} y={64} w={92} h={24} text={t(lang, 'Blocco', 'Block')} tone="green" />
        <text x="292" y="108" textAnchor="middle" className={styles.caption}>{t(lang, 'uno per giocatore', 'one per player')}</text>

        <Row y={138} badge="MA" text={t(lang, 'Ogni giocatore agisce una volta per turno: dichiari l\'azione e la chiudi.', 'Each player acts once per turn: declare the action, then finish it.')} />
        <Row y={168} badge="RUSH" tone="red" text={t(lang, 'Oltre il movimento: 1 casella in più con un 2+ (due al massimo).', 'Past your movement: one extra square on a 2+ (two at most).')} />
      </Plate>
  );
}

function TackleZone({ lang }: { lang: Lang }) {
  const x = 18, y = 14, sq = 26, cols = 5, rows = 5;
  const cx = x + sq * 2.5;
  const cy = y + sq * 2.5;
  return (
      <Plate label={t(lang, 'TACKLE ZONE: LE CASELLE ATTORNO', 'TACKLE ZONE: THE SQUARES AROUND')} animated lang={lang}>
        <Pitch x={x} y={y} w={sq * cols} h={sq * rows} cols={cols} rows={rows} />
        <g className={styles.step} style={at(0.1)}>
          <rect x={x + sq} y={y + sq} width={sq * 3} height={sq * 3} className={styles.zone} />
          <rect x={x + sq * 2} y={y + sq * 2} width={sq} height={sq} className={styles.zoneHole} />
        </g>
        <Token cx={cx} cy={cy} r={10} side="away" />
        <g className={styles.step} style={at(0.5)}>
          <Token cx={x + sq * 1.5} cy={y + sq * 3.5} r={10} side="home" ghost />
          <Arrow d={`M ${x + sq * 1.5} ${y + sq * 1.9} L ${x + sq * 1.5} ${y + sq * 3.1}`} />
        </g>
        <g className={styles.slide} style={slideTo(0.8, 0, sq * 2)}>
          <Token cx={x + sq * 1.5} cy={y + sq * 1.5} r={10} side="home" />
        </g>
        <g className={styles.step} style={at(1.6)}>
          <text x={x + sq * 1.5 + 8} y={y + sq * 2.6} className={styles.mod}>-1</text>
        </g>

        <g className={styles.step} style={at(1.9)}>
          <Label x={162} y={26} width={184}>{t(lang, 'Sei "marcato"', 'You are "Marked"')}</Label>
          <Note x={162} y={40} width={184}>{t(lang, 'Uscire da una casella marcata richiede una schivata (test di AG).', 'Leaving a marked square needs a Dodge (AG test).')}</Note>
        </g>
        <g className={styles.step} style={at(2.2)}>
          <Label x={162} y={74} width={184}>{t(lang, 'Il modificatore', 'The modifier')}</Label>
          <Note x={162} y={88} width={184}>{t(lang, '-1 per ogni avversario che marca la casella dove arrivi.', '-1 for each opponent marking the square you land in.')}</Note>
        </g>
        <g className={styles.step} style={at(2.5)}>
          <Row y={116} badge="✕" tone="red" x={162} w={184} text={t(lang, 'Schivata fallita: cadi, e il turno finisce lì.', 'Failed dodge: you fall and the turn ends.')} />
        </g>
        <g className={styles.step} style={at(2.8)}>
          <Row y={146} badge="✓" tone="green" x={162} w={184} text={t(lang, 'Casella libera: nessun dado, cammini.', 'Open square: no dice, just walk.')} />
        </g>
        <g className={styles.step} style={at(3.1)}>
          <Note x={18} y={186}>{t(lang, 'Chi è a terra o Distratto non ha Tackle Zone.', 'Players who are down or Distracted have no Tackle Zone.')}</Note>
        </g>
      </Plate>
  );
}

function Turnover({ lang }: { lang: Lang }) {
  const causes: [string, 'red' | 'green'][] = [
    [t(lang, 'Un tuo giocatore cade o viene atterrato', 'One of your players falls or is knocked down'), 'red'],
    [t(lang, 'Raccolta della palla fallita', 'Failed pick-up'), 'red'],
    [t(lang, 'Passaggio fumbled, presa sbagliata o intercetto', 'Fumbled pass, dropped catch or interception'), 'red'],
    [t(lang, 'Fallo scoperto dall\'arbitro', 'Foul spotted by the referee'), 'red'],
    [t(lang, 'Touchdown: il turno finisce, ma hai segnato', 'Touchdown: the turn ends, but you scored'), 'green'],
  ];
  return (
      <Plate label={t(lang, 'IL TURNOVER', 'THE TURNOVER')} animated lang={lang}>
        {causes.map(([c, tone], i) => (
            <g key={c} className={styles.step} style={at(0.1 + i * 0.28)}>
              <Row y={12 + i * 30} badge={tone === 'green' ? 'TD' : '✕'} tone={tone} text={c} />
            </g>
        ))}
        <g className={styles.step} style={at(1.5)}>
          <Note x={14} y={182}>{t(lang, 'Anche se avevi ancora otto giocatori da muovere: il turno passa all\'avversario.', 'Even with eight players still to move: the turn passes to your opponent.')}</Note>
        </g>
      </Plate>
  );
}

function Pickup({ lang }: { lang: Lang }) {
  const x = 16, y = 16, sq = 26;
  const cy = y + sq * 1.5;
  const dash = sq * 2;            // la corsa: due caselle, dalla prima a quella della palla
  return (
      <Plate label={t(lang, 'RACCOGLIERE LA PALLA', 'PICKING UP THE BALL')} animated lang={lang}>
        <Pitch x={x} y={y} w={sq * 4} h={sq * 3} cols={4} rows={3} />
        <rect x={x + sq * 2} y={y + sq} width={sq} height={sq} className={styles.zone} />

        {/* la palla sparisce quando il token le arriva sopra: due dischi sovrapposti si leggono male */}
        <g className={styles.fade} style={at(1.15)}>
          <Ball cx={x + sq * 2.5} cy={cy} />
        </g>

        <g className={styles.step} style={at(0.1)}>
          <Arrow d={`M ${x + sq * 0.9} ${cy} L ${x + sq * 2.1} ${cy}`} />
        </g>
        <g className={styles.slide} style={slideTo(0.35, dash)}>
          <Token cx={x + sq * 0.5} cy={cy} r={10} side="home" />
        </g>
        <Note x={x} y={y + sq * 3 + 14}>{t(lang, 'Entri nella casella della palla: test di AG.', 'Step into the ball square: AG test.')}</Note>

        <g className={styles.step} style={at(1.3)}>
          <rect x="136" y="10" width="210" height="88" className={styles.panelPaper} />
          <text x="146" y="26" className={styles.panelTitleDark}>{t(lang, 'IL TIRO', 'THE ROLL')}</text>
          <Note x={146} y={42} width={196}>{t(lang, "• numero bersaglio = AG del giocatore", "• target number = the player’s AG")}</Note>
          <Note x={146} y={56} width={196}>{t(lang, '• -1 per ogni avversario che ti marca', '• -1 for each opponent marking you')}</Note>
          <Note x={146} y={70} width={196}>{t(lang, '• riuscito: continui a muoverti', '• success: you keep moving')}</Note>
          <Note x={146} y={84} width={196}>{t(lang, '• fallito: la palla rimbalza ed è turnover', '• failure: the ball bounces, turnover')}</Note>
        </g>

        <g className={styles.step} style={at(1.65)}>
          <Row y={110} badge="2+" tone="green" text="Secure the Ball" note={t(lang, "azione una volta per turno: raccogli con 2+, ma l’attivazione finisce lì", "once-per-turn action: pick up on a 2+, but your activation ends there")} />
        </g>
        <g className={styles.step} style={at(2)}>
          <Row y={142} badge="!" tone="red" text={t(lang, 'Nessun avversario in piedi entro 2 caselle', 'No standing opponent within 2 squares')} note={t(lang, 'è la condizione per poter usare Secure the Ball', 'that is the condition for using Secure the Ball')} />
        </g>
        <g className={styles.step} style={at(2.3)}>
          <Note x={14} y={186}>{t(lang, 'La palla a terra rimbalza sempre di una casella a caso.', 'A loose ball always bounces one random square.')}</Note>
        </g>
      </Plate>
  );
}

function PassRanges({ lang }: { lang: Lang }) {
  const bands: [string, string, string][] = [
    ['Quick Pass', '0', '#4f7a2f'],
    ['Short Pass', '-1', '#8a8420'],
    ['Long Pass', '-2', '#c48d14'],
    ['Long Bomb', '-3', '#b8222a'],
  ];
  const x0 = 46;
  const y0 = 66;
  const w = 74;
  return (
      <Plate label={t(lang, 'LE QUATTRO GITTATE DEL PASSAGGIO', 'THE FOUR PASSING RANGES')} animated lang={lang}>
        <Token cx={26} cy={y0 + 18} r={12} side="home" />
        {bands.map(([name, mod, color], i) => (
            <g key={name} className={styles.step} style={at(0.1 + i * 0.25)}>
              <rect x={x0 + i * w} y={y0} width={w - 4} height="36" fill={color} opacity={0.22} />
              <rect x={x0 + i * w} y={y0} width={w - 4} height="36" fill="none" stroke={color} strokeWidth="1.6" />
              <text x={x0 + i * w + (w - 4) / 2} y={y0 - 8} textAnchor="middle" className={styles.rangeName} fill={color}>{name}</text>
              <text x={x0 + i * w + (w - 4) / 2} y={y0 + 26} textAnchor="middle" className={styles.rangeMod} fill={color}>{mod}</text>
            </g>
        ))}
        <g className={styles.step} style={at(1.1)}>
          <Arrow d={`M ${x0} ${y0 + 48} L ${x0 + 4 * w - 8} ${y0 + 48}`} />
        </g>
        {/* la palla attraversa le quattro gittate: qui il movimento e' la regola */}
        <g className={styles.slide} style={slideTo(1.2, 296)}>
          <Ball cx={38} cy={y0 + 2} s={0.8} />
        </g>
        <g className={styles.step} style={at(1.5)}>
          <Note x={x0} y={y0 + 62}>{t(lang, 'Più lontano tiri, peggiore è il modificatore: si misura con il righello in qualsiasi direzione.', 'The further you throw, the worse the modifier: measure with the ruler in any direction.')}</Note>
        </g>

        <g className={styles.step} style={at(1.75)}>
          <Row y={142} badge="PA" text={t(lang, 'Test di PA con la gittata, -1 per ogni avversario che ti marca.', 'PA test with the range, -1 for each opponent marking you.')} />
        </g>
        <g className={styles.step} style={at(2)}>
          <Row y={172} badge="1" tone="red" text={t(lang, 'Un 1 dopo i modificatori è un fumble: palla persa e turnover.', 'A 1 after modifiers is a fumble: ball lost and turnover.')} />
        </g>
      </Plate>
  );
}

function CatchDiagram({ lang }: { lang: Lang }) {
  const mods: [string, string][] = [
    ['-1', t(lang, 'Per ogni avversario che ti marca', 'For each opponent marking you')],
    ['-1', t(lang, 'Prendere una palla che rimbalza', 'Catching a bouncing ball')],
    ['-2', t(lang, 'Intercettare un passaggio impreciso', 'Intercepting an inaccurate pass')],
    ['-3', t(lang, 'Intercettare un passaggio preciso', 'Intercepting an accurate pass')],
  ];
  return (
      <Plate label={t(lang, 'PRESE E INTERCETTI: I MODIFICATORI', 'CATCHES AND INTERCEPTIONS: MODIFIERS')}>
        {mods.map(([mod, label], i) => (
            <Row key={label} y={12 + i * 30} badge={mod} tone={i > 1 ? 'red' : 'navy'} text={label} />
        ))}
        <rect x="14" y="134" width={W - 28} height="44" className={styles.panelPaper} />
        <text x="24" y="150" className={styles.panelTitleDark}>{t(lang, 'CHI PUÒ PROVARCI', 'WHO MAY TRY')}</text>
        <Note x={24} y={166}>{t(lang, 'Solo chi è in piedi, non Distratto e nella casella giusta: chi è a terra guarda e basta.', 'Only standing, non-Distracted players in the right square: those on the ground just watch.')}</Note>
      </Plate>
  );
}

function Touchdown({ lang }: { lang: Lang }) {
  const x = 16, y = 18, w = 240, h = 104, cols = 8, rows = 4;
  const cw = w / cols;
  return (
      <Plate label={t(lang, 'SEGNARE — E LO STALLING', 'SCORING — AND STALLING')} animated lang={lang}>
        <Pitch x={x} y={y} w={w} h={h} cols={cols} rows={rows} />
        <rect x={x + w - cw} y={y} width={cw} height={h} className={styles.endzone} />
        <text x={x + w - cw / 2} y={y + h / 2} className={styles.vLabel} transform={`rotate(-90 ${x + w - cw / 2} ${y + h / 2})`}>END ZONE</text>
        <g className={styles.step} style={at(0.15)}>
          <Token cx={x + cw * 4.5} cy={y + h / 2} r={11} side="home" ghost />
        </g>
        {/* la corsa in end zone: 60 unita' = due caselle, palla al seguito */}
        <g className={styles.slide} style={slideTo(0.6, 60)}>
          <Token cx={x + cw * 4.5} cy={y + h / 2} r={11} side="home" label="TD" />
          <Ball cx={x + cw * 4.5 + 10} cy={y + h / 2 - 10} s={0.8} />
        </g>
        <g className={styles.step} style={at(0.3)}>
          <Arrow d={`M ${x + cw * 5.1} ${y + h / 2} L ${x + w - cw * 2.1} ${y + h / 2}`} />
        </g>

        <g className={styles.step} style={at(1.5)}>
          <rect x="266" y="18" width="80" height="104" className={styles.panelGold} />
          <text x="306" y="36" textAnchor="middle" className={styles.panelTitleDark}>TD</text>
          <Note x={306} y={54} anchor="middle" width={76}>{t(lang, 'in piedi', 'standing')}</Note>
          <Note x={306} y={70} anchor="middle" width={76}>{t(lang, '+ palla in mano', '+ ball in hand')}</Note>
          <Note x={306} y={86} anchor="middle" width={76}>+ End Zone</Note>
          <Note x={306} y={106} anchor="middle" width={76}>{t(lang, 'il drive finisce', 'the drive ends')}</Note>
        </g>

        <g className={styles.step} style={at(1.9)}>
          <Row y={132} badge="D6" tone="red" text="Stalling" note={t(lang, 'potevi segnare senza tirare dadi e non l\'hai fatto: D6 ≥ numero del turno e il pubblico ti stende', 'you could score without dice and chose not to: D6 ≥ turn number and the crowd floors you')} />
        </g>
        <g className={styles.step} style={at(2.2)}>
          <Note x={14} y={182}>{t(lang, 'Lo Stalling toglie anche 10.000 di incasso a fine partita.', 'Stalling also costs you 10,000 in winnings after the game.')}</Note>
        </g>
      </Plate>
  );
}

function BlockDiceCount({ lang }: { lang: Lang }) {
  const rows: [string, number, boolean, string][] = [
    [t(lang, 'Stessa ST', 'Same ST'), 1, false, t(lang, 'un dado solo: ti prendi quel che viene', 'a single die: you take what comes')],
    [t(lang, 'Sei più forte', 'You are stronger'), 2, false, t(lang, 'due dadi e scegli tu', 'two dice and you pick')],
    [t(lang, 'La tua ST è più del doppio', 'Your ST is over double'), 3, false, t(lang, 'tre dadi e scegli tu', 'three dice and you pick')],
    [t(lang, 'Sei più debole', 'You are weaker'), 2, true, t(lang, 'due dadi, ma sceglie l\'avversario', 'two dice, but the opponent picks')],
    [t(lang, 'La sua ST è più del doppio', 'Their ST is over double'), 3, true, t(lang, 'tre dadi, e sceglie l\'avversario', 'three dice, and the opponent picks')],
  ];
  return (
      <Plate label={t(lang, 'QUANTI DADI SI TIRANO (E CHI SCEGLIE)', 'HOW MANY DICE, AND WHO PICKS')} animated lang={lang}>
        {rows.map(([label, n, theirs, note], i) => {
          const y = 6 + i * 33;
          return (
              <g key={label} className={styles.step} style={at(0.1 + i * 0.3)}>
                <rect x="14" y={y} width={W - 28} height="30" className={theirs ? styles.rowBgAlt : styles.rowBg} />
                <text x="26" y={y + 13} className={styles.rowTitle}>{label}</text>
                <text x="26" y={y + 25} className={styles.caption}>{note}</text>
                <g className={styles.step} style={at(0.35 + i * 0.3)}>
                  {Array.from({ length: n }, (_, k) => <MiniDie key={k} x={258 + k * 26} y={y + 7} s={16} theirs={theirs} />)}
                </g>
              </g>
          );
        })}
        <g className={styles.step} style={at(1.9)}>
          <Note x={14} y={178}>{t(lang, 'Si conta la ST dopo le assistenze: ogni assistenza vale +1 e può ribaltare il confronto.', 'Strength counts after assists: each assist is +1 and can turn the comparison around.')}</Note>
        </g>
      </Plate>
  );
}

function Assists({ lang }: { lang: Lang }) {
  const x = 16, y = 16, sq = 30;
  return (
      <Plate label={t(lang, 'LE ASSISTENZE', 'ASSISTS')} animated lang={lang}>
        <Pitch x={x} y={y} w={sq * 4} h={sq * 3} cols={4} rows={3} />
        <Token cx={x + sq * 0.5} cy={y + sq * 1.5} r={12} side="home" label="A" />
        <Token cx={x + sq * 1.5} cy={y + sq * 1.5} r={12} side="away" label="B" />
        {/* il compagno arriva a marcare B: e' lui il +1 di ST */}
        <g className={styles.slide} style={slideTo(0.4, sq)}>
          <Token cx={x + sq * 0.5} cy={y + sq * 0.5} r={12} side="home" label="+1" />
        </g>
        {/* Il secondo compagno marca B anche lui, ma l'avversario accanto lo tiene
            occupato: assiste solo chi non e' marcato da nessun altro. Le due caselle
            sono scelte perche' l'avversario NON sfiora il +1 la' sopra. */}
        <g className={styles.step} style={at(1.8)}>
          <Token cx={x + sq * 1.5} cy={y + sq * 2.5} r={12} side="home" label="✕" />
        </g>
        <g className={styles.step} style={at(2.2)}>
          <Token cx={x + sq * 2.5} cy={y + sq * 2.5} r={12} side="away" />
        </g>
        <g className={styles.step} style={at(1.4)}>
          <Arrow d={`M ${x + sq * 0.9} ${y + sq * 1.5} L ${x + sq * 1.1} ${y + sq * 1.5}`} />
        </g>

        <g className={styles.step} style={at(2.6)}>
          <Label x={148} y={26} width={198}>{t(lang, 'A blocca B', 'A blocks B')}</Label>
          <Note x={148} y={40} width={198}>{t(lang, 'Il compagno sopra a B lo marca e non è marcato da altri: vale +1 di ST.', 'A\'s team-mate marks B and is marked by nobody else: that is +1 ST.')}</Note>
        </g>
        <g className={styles.step} style={at(2.85)}>
          <Row y={64} badge="+1" tone="green" x={148} w={198} text={t(lang, 'Assistenza offensiva', 'Offensive assist')} note={t(lang, 'chi attacca guadagna forza', 'the attacker gains strength')} />
        </g>
        <g className={styles.step} style={at(3.1)}>
          <Row y={96} badge="+1" tone="navy" x={148} w={198} text={t(lang, 'Assistenza difensiva', 'Defensive assist')} note={t(lang, 'stessa regola, a favore del bersaglio', 'same rule, for the target')} />
        </g>
        <g className={styles.step} style={at(3.35)}>
          <Row y={140} badge="✕" tone="red" text={t(lang, 'Chi è marcato da un altro avversario non può assistere: resta occupato.', 'A player marked by another opponent cannot assist: they are busy.')} />
        </g>
        <g className={styles.step} style={at(3.6)}>
          <Note x={14} y={186}>{t(lang, 'Chi è a terra, stordito o Distratto non conta come assistenza.', 'Players who are down, stunned or Distracted never assist.')}</Note>
        </g>
      </Plate>
  );
}

function InjuryChain({ lang }: { lang: Lang }) {
  const steps: [string, string, string, 'navy' | 'gold' | 'red'][] = [
    ['2D6', t(lang, 'ARMATURA', 'ARMOUR'), t(lang, 'supera AV e la rompi; altrimenti resta solo a terra', 'beat AV to break it; otherwise they are simply down'), 'navy'],
    ['2D6', t(lang, 'INFORTUNIO', 'INJURY'), t(lang, '2-7 Stordito · 8-9 KO · 10+ Casualty', '2-7 Stunned · 8-9 KO · 10+ Casualty'), 'gold'],
    ['D16', 'CASUALTY', t(lang, '1-8 BH · 9-10 SH · 11-12 SI · 13-14 LI · 15-16 morto', '1-8 BH · 9-10 SH · 11-12 SI · 13-14 LI · 15-16 dead'), 'red'],
  ];
  return (
      <Plate label={t(lang, 'DALLA BOTTA ALL\'INFERMERIA', 'FROM THE HIT TO THE APOTHECARY')} animated lang={lang}>
        {steps.map(([dice, title, detail, tone], i) => {
          const y = 12 + i * 56;
          const cls = tone === 'red' ? styles.stepRed : tone === 'gold' ? styles.stepGold : styles.stepNavy;
          return (
              <g key={title} className={styles.step} style={at(0.15 + i * 0.5)}>
                <rect x="14" y={y} width={W - 28} height="44" className={cls} />
                <rect x="20" y={y + 8} width="44" height="28" rx="2" className={styles.badgeNavy} />
                <text x="42" y={y + 26} className={styles.badgeText}>{dice}</text>
                <text x="76" y={y + 22} className={styles.rowTitle}>{title}</text>
                <text x="76" y={y + 36} className={styles.caption}>{detail}</text>
                {i < 2 && <path d={`M ${W / 2} ${y + 44} l 6 8 h -12 z`} className={styles.stepArrow} />}
              </g>
          );
        })}
        <g className={styles.step} style={at(1.6)}>
          <Note x={14} y={186}>{t(lang, 'Ogni Casualty vale 2 SPP a chi l\'ha causata con un blocco.', 'Each Casualty is worth 2 SPP to whoever caused it with a block.')}</Note>
        </g>
      </Plate>
  );
}

function Foul({ lang }: { lang: Lang }) {
  return (
      <Plate label={t(lang, 'IL FALLO', 'THE FOUL')}>
        <Row y={12} badge="AV" text={t(lang, 'Tiro armatura sul bersaglio a terra', 'Armour roll against the player on the ground')} note={t(lang, '+1 per ogni assistenza offensiva, -1 per ogni difensiva', '+1 per offensive assist, -1 per defensive assist')} />
        <Row y={44} badge="✕✕" tone="red" text={t(lang, 'Doppio su armatura o infortunio: espulso', 'A double on armour or injury: sent off')} note={t(lang, 'il giocatore lascia il campo e la squadra subisce un turnover', 'the player leaves the pitch and the team suffers a turnover')} />

        <rect x="14" y="84" width={W - 28} height="66" className={styles.panelPaper} />
        <text x="24" y="100" className={styles.panelTitleDark}>ARGUE THE CALL (D6)</text>
        {[['1', t(lang, 'via anche l\'allenatore', 'the coach goes too'), 'red'],
          ['2-5', t(lang, 'niente da fare', 'no luck'), 'navy'],
          ['6', t(lang, 'il giocatore resta', 'the player stays'), 'green']].map(([n, label, tone], i) => (
            <g key={n}>
              <Chip x={24 + i * 108} y={108} w={44} h={22} text={n} tone={tone as 'red' | 'navy' | 'green'} />
              <text x={72 + i * 108} y={123} className={styles.caption}>{label}</text>
            </g>
        ))}
        <Note x={14} y={170}>{t(lang, 'Il fallo è un\'azione: una sola per turno, e solo se l\'arbitro non ti vede.', 'A Foul is an action: one per turn, and only if the referee misses it.')}</Note>
      </Plate>
  );
}

function SppTable({ lang }: { lang: Lang }) {
  const rows: [string, string, 'navy' | 'gold' | 'green'][] = [
    ['4', t(lang, 'MVP di fine partita (uno a caso tra i tuoi)', 'End-of-game MVP (random among your players)'), 'gold'],
    ['3', 'Touchdown', 'green'],
    ['2', t(lang, 'Casualty causata con un blocco', 'Casualty caused by a block'), 'navy'],
    ['2', t(lang, 'Intercetto riuscito', 'Successful interception'), 'navy'],
    ['1', t(lang, 'Passaggio completato', 'Completed pass'), 'navy'],
  ];
  return (
      <Plate label={t(lang, 'QUANTI SPP VALGONO LE AZIONI', 'HOW MANY SPP ACTIONS ARE WORTH')}>
        {rows.map(([n, label, tone], i) => (
            <Row key={label} y={12 + i * 30} badge={n} tone={tone} text={label} />
        ))}
        <Note x={14} y={182}>{t(lang, 'Gli SPP si spendono in avanzamenti: ogni avanzamento alza anche il valore del giocatore.', 'SPP are spent on advancements: each one also raises the player\'s value.')}</Note>
      </Plate>
  );
}

function PettyCash({ lang }: { lang: Lang }) {
  return (
      <Plate label={t(lang, 'PETTY CASH', 'PETTY CASH')}>
        <rect x="14" y="12" width="150" height="66" className={styles.panelNavy} />
        <text x="89" y="34" textAnchor="middle" className={styles.panelTitle}>{t(lang, 'CTV PIÙ ALTO', 'HIGHER CTV')}</text>
        <text x="89" y="52" textAnchor="middle" className={styles.captionLight}>{t(lang, 'compra incentivi', 'buys inducements')}</text>
        <text x="89" y="66" textAnchor="middle" className={styles.captionLight}>{t(lang, 'con la propria cassa', 'from its own treasury')}</text>

        <rect x="196" y="12" width="150" height="66" className={styles.panelGold} />
        <text x="271" y="34" textAnchor="middle" className={styles.panelTitleDark}>{t(lang, 'CTV PIÙ BASSO', 'LOWER CTV')}</text>
        <text x="271" y="52" textAnchor="middle" className={styles.caption}>{t(lang, 'riceve Petty Cash', 'receives Petty Cash')}</text>
        <text x="271" y="66" textAnchor="middle" className={styles.caption}>{t(lang, 'e la spende subito', 'and spends it there and then')}</text>

        <Arrow d="M 168 45 L 192 45" tone="navy" />

        <rect x="14" y="90" width={W - 28} height="40" className={styles.formulaBox} />
        <text x={W / 2} y="110" textAnchor="middle" className={styles.formula}>
          {t(lang, 'differenza di CTV + spesa dell\'altra squadra', 'CTV gap + what the other team spent')}
        </text>
        <text x={W / 2} y="124" textAnchor="middle" className={styles.caption}>
          {t(lang, 'da spendere prima del calcio d\'inizio', 'to spend before the kick-off')}
        </text>

        <Row y={140} badge="50k" tone="navy" text={t(lang, 'Puoi aggiungere fino a 50.000 dalla tua cassa.', 'You may add up to 50,000 from your own treasury.')} />
        <Note x={14} y={186}>{t(lang, 'CTV uguali: nessuno compra incentivi.', 'Equal CTV: nobody buys inducements.')}</Note>
      </Plate>
  );
}

function Winnings({ lang }: { lang: Lang }) {
  return (
      <Plate label={t(lang, 'INCASSI E TIFOSI', 'WINNINGS AND FANS')}>
        <rect x="14" y="12" width={W - 28} height="46" className={styles.formulaBox} />
        <text x={W / 2} y="34" textAnchor="middle" className={styles.formula}>
          ( Fan Attendance ÷ 2 + TD + 1* ) × 10.000
        </text>
        <text x={W / 2} y="50" textAnchor="middle" className={styles.caption}>
          {t(lang, '* il +1 solo se nessuno dei tuoi ha fatto Stalling', '* the +1 only if none of your players was Stalling')}
        </text>

        <text x="14" y="78" className={styles.rowTitle}>DEDICATED FANS</text>
        {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
            <g key={n}>
              <rect x={14 + i * 48} y="86" width="40" height="26" className={n <= 4 ? styles.fanOn : styles.fanOff} />
              <text x={34 + i * 48} y="104" className={n <= 4 ? styles.fanNumOn : styles.fanNumOff}>{n}</text>
            </g>
        ))}
        <Note x={14} y={126}>{t(lang, 'Da 1 a 7: entrano nel pubblico di ogni partita e nel tuo incasso.', 'From 1 to 7: they feed the crowd of every game and your winnings.')}</Note>

        <Row y={136} badge="WIN" tone="green" text={t(lang, 'Vinci: D6 maggiore o uguale ai tuoi fan → +1', 'Win: D6 equal or above your fans → +1')} />
        <Row y={166} badge="LOSS" tone="red" text={t(lang, 'Perdi: D6 minore dei tuoi fan → -1 (pareggio: nulla)', 'Lose: D6 below your fans → -1 (draw: nothing)')} />
      </Plate>
  );
}

function InjuryLeague({ lang }: { lang: Lang }) {
  const rows: [string, string, string, 'red' | 'navy' | 'gold'][] = [
    ['MNG', t(lang, 'Missing Next Game', 'Missing Next Game'), t(lang, 'salta la partita successiva', 'misses the next fixture'), 'red'],
    ['NI', t(lang, 'Niggling Injury', 'Niggling Injury'), t(lang, '+1 ai futuri tiri Casualty: si rompe più facilmente', '+1 to future Casualty rolls: easier to break'), 'red'],
    ['-1', t(lang, 'Caratteristica persa', 'Characteristic loss'), t(lang, 'MA, ST, AG, PA o AV peggiorano per sempre', 'MA, ST, AG, PA or AV gets worse for good'), 'navy'],
    ['DEAD', t(lang, 'Morto', 'Dead'), t(lang, 'fuori dal roster: resta l\'apothecary, se ce l\'hai', 'off the roster: only the apothecary can help'), 'gold'],
  ];
  return (
      <Plate label={t(lang, 'COSA RESTA DOPO LA PARTITA', 'WHAT IS LEFT AFTER THE GAME')}>
        {rows.map(([tag, title, note, tone], i) => (
            <Row key={tag} y={12 + i * 38} badge={tag} tone={tone} text={title} note={note} />
        ))}
        <Note x={14} y={182}>{t(lang, 'KO e storditi tornano: gli infortuni veri restano sulla scheda del giocatore.', 'KO and stunned players come back: real injuries stay on the player card.')}</Note>
      </Plate>
  );
}

function Postgame({ lang }: { lang: Lang }) {
  const steps = [
    t(lang, 'Incassi', 'Winnings'),
    t(lang, 'Dedicated Fans', 'Dedicated Fans'),
    t(lang, 'Avanzamenti', 'Advancements'),
    t(lang, 'Ingaggi e tagli', 'Hiring and firing'),
    'Journeymen',
    'Expensive Mistakes',
  ];
  return (
      <Plate label={t(lang, 'I SEI PASSI DEL POST-PARTITA', 'THE SIX POST-GAME STEPS')}>
        {steps.map((s, i) => {
          const y = 10 + i * 26;
          const last = i === steps.length - 1;
          return (
              <g key={s}>
                <path d={`M 14 ${y} h 306 l 12 11 l -12 11 h -306 z`} className={last ? styles.stepRed : styles.stepNavy} />
                <circle cx="32" cy={y + 11} r="9" className={last ? styles.dotRed : styles.dotNavy} />
                <text x="32" y={y + 15} className={styles.stepNumber}>{i + 1}</text>
                <text x="50" y={y + 15} className={styles.rowTitle}>{s}</text>
              </g>
          );
        })}
        <text x="14" y="184" className={styles.panelTitleDark}>{t(lang, 'SPENDI PRIMA DELL\'ULTIMO PASSO', 'SPEND BEFORE THE LAST STEP')}</text>
        <Note x={14} y={196}>{t(lang, 'Con più di 100.000 in cassa gli Expensive Mistakes possono portarti via quasi tutto.', 'Above 100,000 in the treasury, Expensive Mistakes can take nearly all of it.')}</Note>
      </Plate>
  );
}

const DIAGRAMS: Record<string, (p: { lang: Lang }) => React.ReactElement> = {
  pitch: PitchDiagram,
  profile: Profile,
  dice: TargetNumber,
  targetNumber: TargetNumber,
  turnStructure: TurnStructure,
  actions: Actions,
  tackleZone: TackleZone,
  turnover: Turnover,
  pickup: Pickup,
  passRanges: PassRanges,
  catch: CatchDiagram,
  touchdown: Touchdown,
  blockDice: BlockDiceCount,
  assists: Assists,
  injuryChain: InjuryChain,
  foul: Foul,
  sppTable: SppTable,
  pettyCash: PettyCash,
  winnings: Winnings,
  injuryLeague: InjuryLeague,
  postgame: Postgame,
};

export default function TutorialDiagram({ id, lang }: Props) {
  const Diagram = id ? DIAGRAMS[id] : undefined;
  if (!Diagram) return null;
  return <Diagram lang={lang} />;
}
