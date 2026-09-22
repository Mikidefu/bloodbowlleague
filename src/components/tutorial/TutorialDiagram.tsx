'use client';
import type { Lang } from '@/lib/tutorial';
import styles from './TutorialDiagram.module.css';

// Diagrammi originali del tutorial: nessuna immagine presa dal manuale, solo SVG disegnati qui.
// Colori e testo seguono il tema del sito tramite le variabili CSS.

type Props = { id?: string; lang: Lang };

const t = (lang: Lang, it: string, en: string) => (lang === 'it' ? it : en);

// --- mattoncini riutilizzabili -------------------------------------------------
const Grid = ({ x, y, cols, rows, size = 14 }: { x: number; y: number; cols: number; rows: number; size?: number }) => (
    <g className={styles.grid}>
      {Array.from({ length: cols + 1 }, (_, i) => <line key={`v${i}`} x1={x + i * size} y1={y} x2={x + i * size} y2={y + rows * size} />)}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={`h${i}`} x1={x} y1={y + i * size} x2={x + cols * size} y2={y + i * size} />)}
    </g>
);

const Piece = ({ cx, cy, side = 'home', label }: { cx: number; cy: number; side?: 'home' | 'away'; label?: string }) => (
    <g>
      <circle cx={cx} cy={cy} r={5.5} className={side === 'home' ? styles.home : styles.away} />
      {label && <text x={cx} y={cy + 3} className={styles.pieceLabel}>{label}</text>}
    </g>
);

const Caption = ({ x, y, children, anchor = 'start' }: { x: number; y: number; children: React.ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
    <text x={x} y={y} textAnchor={anchor} className={styles.caption}>{children}</text>
);

const Frame = ({ children, label }: { children: React.ReactNode; label?: string }) => (
    <figure className={styles.figure}>
      <svg viewBox="0 0 320 180" role="img" aria-label={label} className={styles.svg}>{children}</svg>
    </figure>
);

// --- diagrammi ------------------------------------------------------------------
function Pitch({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Il campo da Blood Bowl', 'The Blood Bowl pitch')}>
        <rect x="20" y="30" width="280" height="120" className={styles.field} />
        <rect x="20" y="30" width="24" height="120" className={styles.endzone} />
        <rect x="276" y="30" width="24" height="120" className={styles.endzone} />
        <rect x="44" y="30" width="232" height="24" className={styles.wide} />
        <rect x="44" y="126" width="232" height="24" className={styles.wide} />
        <line x1="160" y1="30" x2="160" y2="150" className={styles.scrimmage} />
        <Grid x={20} y={30} cols={20} rows={8} />
        <Caption x={32} y={95} anchor="middle">END</Caption>
        <Caption x={288} y={95} anchor="middle">END</Caption>
        <Caption x={160} y={44} anchor="middle">{t(lang, 'WIDE ZONE', 'WIDE ZONE')}</Caption>
        <Caption x={160} y={142} anchor="middle">{t(lang, 'WIDE ZONE', 'WIDE ZONE')}</Caption>
        <Caption x={160} y={95} anchor="middle">{t(lang, 'CENTRE FIELD', 'CENTRE FIELD')}</Caption>
        <Caption x={160} y={22} anchor="middle">{t(lang, 'LINE OF SCRIMMAGE', 'LINE OF SCRIMMAGE')}</Caption>
        <Caption x={160} y={168} anchor="middle">{t(lang, 'SIDELINE: oltre c\'è il pubblico', 'SIDELINE: past it lies the crowd')}</Caption>
      </Frame>
  );
}

function Profile({ lang }: { lang: Lang }) {
  const rows: [string, string][] = [
    ['MA', t(lang, 'caselle di movimento', 'squares of movement')],
    ['ST', t(lang, 'forza nei blocchi', 'strength in blocks')],
    ['AG', t(lang, 'schivate, prese, raccolte', 'dodges, catches, pick-ups')],
    ['PA', t(lang, 'passaggi', 'passes')],
    ['AV', t(lang, 'armatura', 'armour')],
  ];
  return (
      <Frame label={t(lang, 'Le cinque caratteristiche', 'The five characteristics')}>
        {rows.map(([k, v], i) => (
            <g key={k}>
              <rect x="20" y={14 + i * 31} width="46" height="24" className={styles.chip} />
              <text x="43" y={31 + i * 31} textAnchor="middle" className={styles.chipText}>{k}</text>
              <text x="78" y={31 + i * 31} className={styles.body}>{v}</text>
            </g>
        ))}
        <text x="300" y="170" textAnchor="end" className={styles.caption}>
          {t(lang, 'AG, PA e AV sono numeri bersaglio (3+)', 'AG, PA and AV are target numbers (3+)')}
        </text>
      </Frame>
  );
}

function Dice({ lang }: { lang: Lang }) {
  const dice = ['D6', 'D8', 'D16', t(lang, 'BLOCCO', 'BLOCK')];
  return (
      <Frame label={t(lang, 'I dadi del gioco', 'The dice of the game')}>
        {dice.map((d, i) => (
            <g key={d}>
              <rect x={22 + i * 74} y="30" width="58" height="58" rx="8" className={styles.chip} />
              <text x={51 + i * 74} y="66" textAnchor="middle" className={styles.chipText}>{d}</text>
            </g>
        ))}
        <text x="22" y="118" className={styles.body}>{t(lang, '1 naturale: fallisce sempre', 'Natural 1: always fails')}</text>
        <text x="22" y="138" className={styles.body}>{t(lang, '6 naturale: riesce sempre', 'Natural 6: always succeeds')}</text>
        <text x="22" y="158" className={styles.body}>{t(lang, 'Team Re-roll: si ricarica a metà partita', 'Team Re-roll: refills at half-time')}</text>
      </Frame>
  );
}

function TurnStructure({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Struttura della partita', 'Match structure')}>
        {[0, 1].map(half => (
            <g key={half}>
              <text x="20" y={40 + half * 70} className={styles.body}>{t(lang, `${half + 1}º tempo`, `Half ${half + 1}`)}</text>
              {Array.from({ length: 8 }, (_, i) => (
                  <g key={i}>
                    <rect x={78 + i * 28} y={24 + half * 70} width="24" height="22" rx="3" className={styles.chip} />
                    <text x={90 + i * 28} y={39 + half * 70} textAnchor="middle" className={styles.chipTextSmall}>{i + 1}</text>
                  </g>
              ))}
              <text x="78" y={62 + half * 70} className={styles.caption}>
                {t(lang, 'ogni round: turno A, poi turno B', 'each round: turn A, then turn B')}
              </text>
            </g>
        ))}
        <text x="20" y="168" className={styles.caption}>
          {t(lang, 'Nel 2º tempo calcia chi ha ricevuto nel 1º', 'In the second half, whoever received now kicks')}
        </text>
      </Frame>
  );
}

function Actions({ lang }: { lang: Lang }) {
  const once = [
    t(lang, 'Blitz', 'Blitz'), t(lang, 'Passaggio', 'Pass'), t(lang, 'Hand-off', 'Hand-off'),
    t(lang, 'Fallo', 'Foul'), t(lang, 'Secure the Ball', 'Secure the Ball'), t(lang, 'Throw Team-mate', 'Throw Team-mate'),
  ];
  return (
      <Frame label={t(lang, 'Azioni e limiti', 'Actions and limits')}>
        <text x="20" y="24" className={styles.body}>{t(lang, 'Una sola volta per turno, in tutta la squadra:', 'Once per turn, for the whole team:')}</text>
        {once.map((a, i) => (
            <g key={a}>
              <rect x={20 + (i % 3) * 96} y={34 + Math.floor(i / 3) * 32} width="88" height="24" rx="4" className={styles.chipWarn} />
              <text x={64 + (i % 3) * 96} y={50 + Math.floor(i / 3) * 32} textAnchor="middle" className={styles.chipTextSmall}>{a}</text>
            </g>
        ))}
        <text x="20" y="126" className={styles.body}>{t(lang, 'Quante volte vuoi:', 'As often as you like:')}</text>
        {[t(lang, 'Movimento', 'Move'), t(lang, 'Blocco', 'Block')].map((a, i) => (
            <g key={a}>
              <rect x={20 + i * 96} y="136" width="88" height="24" rx="4" className={styles.chipOk} />
              <text x={64 + i * 96} y="152" textAnchor="middle" className={styles.chipTextSmall}>{a}</text>
            </g>
        ))}
      </Frame>
  );
}

function TackleZone({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Tackle Zone e giocatori marcati', 'Tackle zones and marked players')}>
        <Grid x={40} y={30} cols={5} rows={5} size={22} />
        <rect x="62" y="52" width="66" height="66" className={styles.zone} />
        <Piece cx={95} cy={85} side="away" />
        <Piece cx={73} cy={63} side="home" />
        <Piece cx={172} cy={85} side="home" />
        <Caption x={95} y={140} anchor="middle">{t(lang, 'le 8 caselle attorno', 'the 8 squares around')}</Caption>
        <text x="200" y="60" className={styles.body}>{t(lang, 'Marcato: deve schivare', 'Marked: must dodge')}</text>
        <text x="200" y="92" className={styles.body}>{t(lang, 'Libero: si muove senza test', 'Open: moves with no test')}</text>
        <text x="200" y="130" className={styles.caption}>{t(lang, 'Schivata: -1 per ogni avversario', 'Dodge: -1 per opponent')}</text>
        <text x="200" y="146" className={styles.caption}>{t(lang, 'che marca la casella d\'arrivo', 'marking the destination square')}</text>
      </Frame>
  );
}

function Turnover({ lang }: { lang: Lang }) {
  const causes = [
    t(lang, 'Un tuo giocatore cade o viene atterrato', 'One of your players falls or is knocked down'),
    t(lang, 'Raccolta della palla fallita', 'Failed pick-up'),
    t(lang, 'Passaggio fumbled o presa sbagliata', 'Fumbled pass or dropped catch'),
    t(lang, 'Palla intercettata dall\'avversario', 'Pass intercepted by the opponent'),
    t(lang, 'Fallo scoperto dall\'arbitro', 'Foul spotted by the referee'),
    t(lang, 'Touchdown (quello buono)', 'Touchdown (the good one)'),
  ];
  return (
      <Frame label={t(lang, 'Cosa causa un turnover', 'What causes a turnover')}>
        {causes.map((c, i) => (
            <g key={c}>
              <circle cx="30" cy={26 + i * 25} r="4" className={i === causes.length - 1 ? styles.dotOk : styles.dot} />
              <text x="44" y={30 + i * 25} className={styles.body}>{c}</text>
            </g>
        ))}
      </Frame>
  );
}

function Pickup({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Raccogliere la palla', 'Picking up the ball')}>
        <rect x="20" y="24" width="130" height="130" rx="6" className={styles.panel} />
        <text x="85" y="46" textAnchor="middle" className={styles.chipText}>{t(lang, 'AL VOLO', 'ON THE RUN')}</text>
        <text x="32" y="72" className={styles.body}>{t(lang, 'Test di AG', 'AG test')}</text>
        <text x="32" y="94" className={styles.body}>{t(lang, '-1 per ogni marcatore', '-1 per marker')}</text>
        <text x="32" y="116" className={styles.body}>{t(lang, 'Fallita: turnover', 'Failed: turnover')}</text>
        <text x="32" y="138" className={styles.caption}>{t(lang, 'Puoi continuare il movimento', 'You may keep moving')}</text>

        <rect x="170" y="24" width="130" height="130" rx="6" className={styles.panelAlt} />
        <text x="235" y="46" textAnchor="middle" className={styles.chipText}>SECURE</text>
        <text x="182" y="72" className={styles.body}>{t(lang, 'D6: 2+ e la prendi', 'D6: 2+ and it is yours')}</text>
        <text x="182" y="94" className={styles.body}>{t(lang, 'Nessun avversario', 'No standing opponent')}</text>
        <text x="182" y="112" className={styles.body}>{t(lang, 'in piedi entro 2 caselle', 'within 2 squares')}</text>
        <text x="182" y="138" className={styles.caption}>{t(lang, 'L\'attivazione finisce lì', 'Your activation ends there')}</text>
      </Frame>
  );
}

function PassRanges({ lang }: { lang: Lang }) {
  const bands: [string, string][] = [
    [t(lang, 'Quick Pass', 'Quick Pass'), '0'],
    [t(lang, 'Short Pass', 'Short Pass'), '-1'],
    [t(lang, 'Long Pass', 'Long Pass'), '-2'],
    [t(lang, 'Long Bomb', 'Long Bomb'), '-3'],
  ];
  return (
      <Frame label={t(lang, 'Gittate del passaggio', 'Passing ranges')}>
        <Piece cx={34} cy={90} side="home" />
        {bands.map(([name, mod], i) => (
            <g key={name}>
              <rect x={52 + i * 64} y="60" width="58" height="60" rx="4" className={styles.band} opacity={1 - i * 0.18} />
              <text x={81 + i * 64} y="86" textAnchor="middle" className={styles.chipTextSmall}>{name}</text>
              <text x={81 + i * 64} y="108" textAnchor="middle" className={styles.chipText}>{mod}</text>
            </g>
        ))}
        <text x="20" y="150" className={styles.body}>{t(lang, 'Test di PA con il modificatore della gittata, -1 per ogni marcatore.', 'PA test with the range modifier, -1 per marker.')}</text>
        <text x="20" y="168" className={styles.caption}>{t(lang, '1 dopo i modificatori: fumble e turnover.', '1 after modifiers: fumble and turnover.')}</text>
      </Frame>
  );
}

function Catch({ lang }: { lang: Lang }) {
  const mods: [string, string][] = [
    [t(lang, 'Intercetto, passaggio preciso', 'Intercept, accurate pass'), '-3'],
    [t(lang, 'Intercetto, passaggio impreciso', 'Intercept, inaccurate pass'), '-2'],
    [t(lang, 'Presa di palla rimbalzata', 'Catching a bounced ball'), '-1'],
    [t(lang, 'Per ogni avversario che ti marca', 'For each opponent marking you'), '-1'],
  ];
  return (
      <Frame label={t(lang, 'Prese e intercetti', 'Catches and interceptions')}>
        {mods.map(([label, mod], i) => (
            <g key={label}>
              <rect x="20" y={22 + i * 34} width="46" height="24" rx="4" className={styles.chipWarn} />
              <text x="43" y={39 + i * 34} textAnchor="middle" className={styles.chipText}>{mod}</text>
              <text x="78" y={39 + i * 34} className={styles.body}>{label}</text>
            </g>
        ))}
        <text x="20" y="170" className={styles.caption}>{t(lang, 'Chi è a terra o distratto non può prendere né intercettare.', 'Players who are down or distracted cannot catch or intercept.')}</text>
      </Frame>
  );
}

function Touchdown({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Touchdown e Stalling', 'Touchdown and stalling')}>
        <rect x="20" y="40" width="280" height="80" className={styles.field} />
        <rect x="264" y="40" width="36" height="80" className={styles.endzone} />
        <Grid x={20} y={40} cols={20} rows={5} size={14} />
        <Piece cx={278} cy={80} side="home" label="TD" />
        <text x="160" y="28" textAnchor="middle" className={styles.body}>{t(lang, 'In piedi + palla + End Zone avversaria', 'Standing + ball + opposition End Zone')}</text>
        <text x="20" y="146" className={styles.body}>{t(lang, 'Stalling: potevi segnare senza dadi e non l\'hai fatto?', 'Stalling: could you score with no dice and chose not to?')}</text>
        <text x="20" y="166" className={styles.caption}>{t(lang, 'D6 pari o superiore al numero del turno: il pubblico ti stende.', 'D6 equal to or above the turn number: the crowd floors you.')}</text>
      </Frame>
  );
}

function BlockDice({ lang }: { lang: Lang }) {
  const faces: [string, string][] = [
    [t(lang, 'Player Down', 'Player Down'), t(lang, 'cadi tu', 'you fall')],
    [t(lang, 'Both Down', 'Both Down'), t(lang, 'cadete entrambi', 'both fall')],
    [t(lang, 'Push Back', 'Push Back'), t(lang, 'lo spingi', 'you shove them')],
    [t(lang, 'Stumble', 'Stumble'), t(lang, 'Dodge? spinta, altrimenti POW', 'Dodge? push, else POW')],
    [t(lang, 'POW', 'POW'), t(lang, 'spinta e atterrato', 'push and knocked down')],
  ];
  return (
      <Frame label={t(lang, 'Le facce dei dadi da blocco', 'The block dice faces')}>
        {faces.map(([name, effect], i) => (
            <g key={name}>
              <rect x="20" y={16 + i * 31} width="84" height="24" rx="4" className={i === 0 ? styles.chipWarn : i === 4 ? styles.chipOk : styles.chip} />
              <text x="62" y={33 + i * 31} textAnchor="middle" className={styles.chipTextSmall}>{name}</text>
              <text x="116" y={33 + i * 31} className={styles.body}>{effect}</text>
            </g>
        ))}
      </Frame>
  );
}

function Assists({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Assistenze offensive e difensive', 'Offensive and defensive assists')}>
        <Grid x={30} y={40} cols={4} rows={4} size={22} />
        <Piece cx={63} cy={73} side="home" label="A" />
        <Piece cx={85} cy={95} side="away" label="B" />
        <Piece cx={63} cy={117} side="home" label="+1" />
        <text x="30" y="30" className={styles.body}>{t(lang, 'A blocca B con un\'assistenza: ST +1', 'A blocks B with one assist: ST +1')}</text>
        <text x="170" y="62" className={styles.body}>{t(lang, 'Vale come assistenza chi:', 'An assist counts when the player:')}</text>
        <text x="170" y="86" className={styles.caption}>{t(lang, '• marca il bersaglio', '• marks the target')}</text>
        <text x="170" y="106" className={styles.caption}>{t(lang, '• non è marcato da altri', '• is not marked by anyone else')}</text>
        <text x="170" y="134" className={styles.body}>{t(lang, 'Stessa regola per chi difende.', 'Same rule for the defending side.')}</text>
      </Frame>
  );
}

function InjuryChain({ lang }: { lang: Lang }) {
  const steps: [string, string][] = [
    [t(lang, 'ARMATURA', 'ARMOUR'), t(lang, '2D6 contro AV', '2D6 versus AV')],
    [t(lang, 'INFORTUNIO', 'INJURY'), t(lang, '2-7 stordito · 8-9 KO · 10-12 Casualty', '2-7 stunned · 8-9 KO · 10-12 Casualty')],
    [t(lang, 'CASUALTY', 'CASUALTY'), t(lang, 'D16: 1-8 BH · 9-10 SH · 11-12 SI · 13-14 LI · 15-16 morto', 'D16: 1-8 BH · 9-10 SH · 11-12 SI · 13-14 LI · 15-16 dead')],
  ];
  return (
      <Frame label={t(lang, 'Dalla botta all\'infortunio', 'From the hit to the injury')}>
        {steps.map(([title, detail], i) => (
            <g key={title}>
              <rect x="20" y={24 + i * 50} width="280" height="38" rx="6" className={i === 2 ? styles.panelAlt : styles.panel} />
              <text x="34" y={42 + i * 50} className={styles.chipText}>{title}</text>
              <text x="34" y={57 + i * 50} className={styles.caption}>{detail}</text>
              {i < 2 && <text x="160" y={72 + i * 50} textAnchor="middle" className={styles.caption}>↓</text>}
            </g>
        ))}
        <text x="20" y="176" className={styles.caption}>{t(lang, 'Armatura non rotta: il giocatore resta solo a terra.', 'Armour not broken: the player is simply down.')}</text>
      </Frame>
  );
}

function Foul({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Il fallo', 'The foul')}>
        <rect x="20" y="24" width="280" height="44" rx="6" className={styles.panel} />
        <text x="34" y="44" className={styles.chipText}>{t(lang, 'BERSAGLIO A TERRA', 'TARGET ON THE GROUND')}</text>
        <text x="34" y="60" className={styles.caption}>{t(lang, 'Tiro armatura con +1 per assistenza offensiva, -1 per difensiva', 'Armour roll at +1 per offensive assist, -1 per defensive')}</text>
        <rect x="20" y="78" width="280" height="40" rx="6" className={styles.panelWarn} />
        <text x="34" y="96" className={styles.chipText}>{t(lang, 'DOPPIO = ESPULSO', 'DOUBLE = SENT OFF')}</text>
        <text x="34" y="112" className={styles.caption}>{t(lang, 'Su armatura o infortunio: fuori dal campo e turnover', 'On armour or injury: off the pitch and a turnover')}</text>
        <text x="20" y="140" className={styles.body}>{t(lang, 'Argue the Call (D6):', 'Argue the Call (D6):')}</text>
        <text x="20" y="160" className={styles.caption}>{t(lang, '1 fuori anche l\'allenatore · 2-5 niente · 6 rientra', '1 the coach goes too · 2-5 nothing · 6 he stays')}</text>
      </Frame>
  );
}

function SppTable({ lang }: { lang: Lang }) {
  const rows: [string, string][] = [
    ['3', t(lang, 'Touchdown', 'Touchdown')],
    ['2', t(lang, 'Casualty da blocco', 'Casualty from a block')],
    ['2', t(lang, 'Intercetto', 'Interception')],
    ['1', t(lang, 'Passaggio completato', 'Completed pass')],
    ['4', t(lang, 'MVP di fine partita', 'End-of-game MVP')],
  ];
  return (
      <Frame label={t(lang, 'Quanti SPP valgono le azioni', 'How many SPP actions are worth')}>
        {rows.map(([n, label], i) => (
            <g key={label}>
              <rect x="20" y={22 + i * 30} width="34" height="24" rx="4" className={i === 4 ? styles.chipOk : styles.chip} />
              <text x="37" y={39 + i * 30} textAnchor="middle" className={styles.chipText}>{n}</text>
              <text x="66" y={39 + i * 30} className={styles.body}>{label}</text>
            </g>
        ))}
        <text x="20" y="172" className={styles.caption}>{t(lang, 'Anche lanciare un compagno e atterrare bene: 1 SPP a testa.', 'Throwing a team-mate who lands safely: 1 SPP each.')}</text>
      </Frame>
  );
}

function PettyCash({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Come funziona la Petty Cash', 'How Petty Cash works')}>
        <rect x="20" y="30" width="130" height="60" rx="6" className={styles.panel} />
        <text x="85" y="52" textAnchor="middle" className={styles.chipText}>{t(lang, 'CTV PIÙ ALTO', 'HIGHER CTV')}</text>
        <text x="85" y="72" textAnchor="middle" className={styles.caption}>{t(lang, 'spende dalla cassa', 'spends from the treasury')}</text>
        <rect x="170" y="30" width="130" height="60" rx="6" className={styles.panelAlt} />
        <text x="235" y="52" textAnchor="middle" className={styles.chipText}>{t(lang, 'CTV PIÙ BASSO', 'LOWER CTV')}</text>
        <text x="235" y="72" textAnchor="middle" className={styles.caption}>{t(lang, 'riceve Petty Cash', 'receives Petty Cash')}</text>
        <text x="160" y="118" textAnchor="middle" className={styles.body}>
          {t(lang, 'Petty Cash = differenza di CTV + speso dall\'altra', 'Petty Cash = CTV gap + what the other spent')}
        </text>
        <text x="160" y="142" textAnchor="middle" className={styles.caption}>{t(lang, '+ massimo 50.000 dalla propria cassa', '+ at most 50,000 from its own treasury')}</text>
        <text x="160" y="164" textAnchor="middle" className={styles.caption}>{t(lang, 'CTV pari: nessuno compra incentivi', 'Equal CTV: nobody buys inducements')}</text>
      </Frame>
  );
}

function Winnings({ lang }: { lang: Lang }) {
  return (
      <Frame label={t(lang, 'Come si calcolano gli incassi', 'How winnings are worked out')}>
        <text x="160" y="46" textAnchor="middle" className={styles.formula}>
          ( {t(lang, 'Fan Attendance', 'Fan Attendance')} ÷ 2 + TD + 1* ) × 10.000
        </text>
        <text x="160" y="72" textAnchor="middle" className={styles.caption}>
          {t(lang, '* solo se nessuno dei tuoi ha fatto Stalling', '* only if none of your players was Stalling')}
        </text>
        <rect x="20" y="92" width="280" height="62" rx="6" className={styles.panel} />
        <text x="34" y="114" className={styles.chipText}>{t(lang, 'DEDICATED FANS', 'DEDICATED FANS')}</text>
        <text x="34" y="132" className={styles.caption}>{t(lang, 'Vittoria: D6 ≥ fan → +1 (max 7)', 'Win: D6 ≥ fans → +1 (max 7)')}</text>
        <text x="34" y="148" className={styles.caption}>{t(lang, 'Sconfitta: D6 < fan → -1 (min 1) · Pareggio: nulla', 'Loss: D6 < fans → -1 (min 1) · Draw: nothing')}</text>
      </Frame>
  );
}

function InjuryLeague({ lang }: { lang: Lang }) {
  const rows: [string, string][] = [
    ['MNG', t(lang, 'Salta la partita successiva', 'Misses the next game')],
    ['NI', t(lang, 'Niggling: +1 ai futuri tiri Casualty', 'Niggling: +1 to future casualty rolls')],
    ['LI', t(lang, 'Lasting: -1 a una caratteristica', 'Lasting: -1 to a characteristic')],
    ['TR', t(lang, 'A riposo per la stagione, fuori dal CTV', 'Rested for the season, out of the CTV')],
  ];
  return (
      <Frame label={t(lang, 'Conseguenze in lega', 'League consequences')}>
        {rows.map(([tag, label], i) => (
            <g key={tag}>
              <rect x="20" y={26 + i * 36} width="52" height="26" rx="4" className={i === 3 ? styles.chipOk : styles.chipWarn} />
              <text x="46" y={44 + i * 36} textAnchor="middle" className={styles.chipText}>{tag}</text>
              <text x="86" y={44 + i * 36} className={styles.body}>{label}</text>
            </g>
        ))}
      </Frame>
  );
}

function Postgame({ lang }: { lang: Lang }) {
  const steps = [
    t(lang, 'Incassi', 'Winnings'),
    t(lang, 'Dedicated Fans', 'Dedicated Fans'),
    t(lang, 'Avanzamenti', 'Advancements'),
    t(lang, 'Ingaggi e licenziamenti', 'Hiring and firing'),
    t(lang, 'Journeymen', 'Journeymen'),
    t(lang, 'Expensive Mistakes', 'Expensive Mistakes'),
  ];
  return (
      <Frame label={t(lang, 'I sei passi del post-partita', 'The six post-game steps')}>
        {steps.map((s, i) => (
            <g key={s}>
              <circle cx="36" cy={24 + i * 26} r="9" className={i === 5 ? styles.dotWarn : styles.dotStep} />
              <text x="36" y={28 + i * 26} textAnchor="middle" className={styles.stepNumber}>{i + 1}</text>
              <text x="56" y={28 + i * 26} className={styles.body}>{s}</text>
              {i < steps.length - 1 && <line x1="36" y1={33 + i * 26} x2="36" y2={39 + i * 26} className={styles.stepLine} />}
            </g>
        ))}
        <text x="180" y="150" textAnchor="end" className={styles.caption}>{t(lang, 'Spendi prima dell\'ultimo passo!', 'Spend before the last step!')}</text>
      </Frame>
  );
}

const DIAGRAMS: Record<string, (p: { lang: Lang }) => React.ReactElement> = {
  pitch: Pitch,
  profile: Profile,
  dice: Dice,
  turnStructure: TurnStructure,
  actions: Actions,
  tackleZone: TackleZone,
  turnover: Turnover,
  pickup: Pickup,
  passRanges: PassRanges,
  catch: Catch,
  touchdown: Touchdown,
  blockDice: BlockDice,
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
