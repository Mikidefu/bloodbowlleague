// Tabelle da consultare durante la partita (Rulebook Blood Bowl 2025).
// Come nel tutorial, niente testo copiato dal libro: ogni risultato ha il suo nome ufficiale
// (è il termine di gioco) e un riassunto scritto da noi, con la pagina dove leggere la regola.

export type Lang = 'it' | 'en';
type Text = Record<Lang, string>;

export type TableKey = 'weather' | 'kickoff' | 'injury' | 'stunty' | 'casualty' | 'lasting' | 'argue' | 'prayers';

// Come si tira: 2D6 = due dadi sommati; D16 = un solo dado
export type Dice = { count: number; sides: number };

export type TableRow = {
  min: number;
  max: number;
  name: string;
  text: Text;
  tone: 'good' | 'bad' | 'neutral';
  next?: TableKey;              // il risultato rimanda a un'altra tabella (es. Casualty -> Casualty Table)
};

export type MatchTable = {
  key: TableKey;
  title: Text;
  page: number;
  dice: Dice;
  who: Text;                    // chi tira e quando
  note?: Text;
  modifier?: Text;              // se c'è un modificatore da inserire a mano, cosa rappresenta
  rows: TableRow[];
};

export const diceLabel = ({ count, sides }: Dice) => `${count > 1 ? count : ''}D${sides}`;

const range = (row: TableRow) => (row.min === row.max ? String(row.min) : `${row.min}-${row.max}`);
export const rowRange = range;

export const MATCH_TABLES: MatchTable[] = [
  {
    key: 'weather',
    title: { it: 'Meteo', en: 'Weather' },
    page: 46,
    dice: { count: 2, sides: 6 },
    who: {
      it: 'Prima della partita ogni allenatore tira un D6 e si sommano i due risultati.',
      en: 'Before the game each coach rolls a D6 and the two results are added together.',
    },
    rows: [
      { min: 2, max: 2, name: 'Sweltering Heat', tone: 'bad', text: {
        it: 'A fine drive un allenatore tira un D3: ogni squadra sceglie a caso altrettanti giocatori che erano in campo, che restano nelle riserve per il drive successivo.',
        en: 'At the end of each drive one coach rolls a D3: each team randomly picks that many of its players who were on the pitch, who sit out the next drive in the Reserves.',
      } },
      { min: 3, max: 3, name: 'Very Sunny', tone: 'bad', text: {
        it: '-1 a ogni test di Passing Ability.',
        en: '-1 to every Passing Ability test.',
      } },
      { min: 4, max: 10, name: 'Perfect Conditions', tone: 'neutral', text: {
        it: 'Nessun effetto.',
        en: 'No effect.',
      } },
      { min: 11, max: 11, name: 'Pouring Rain', tone: 'bad', text: {
        it: '-1 per raccogliere la palla, prenderla al volo o tentare un intercetto.',
        en: '-1 to pick up or catch the ball, and to attempt an interception.',
      } },
      { min: 12, max: 12, name: 'Blizzard', tone: 'bad', text: {
        it: 'Un ulteriore -1 a ogni Rush, e i passaggi possono essere solo Quick o Short.',
        en: 'An extra -1 to every Rush, and passes may only be Quick or Short.',
      } },
    ],
  },
  {
    key: 'kickoff',
    title: { it: 'Kick-off', en: 'Kick-off' },
    page: 48,
    dice: { count: 2, sides: 6 },
    who: {
      it: 'Dopo la deviazione del calcio, con la palla ancora in aria, tira la squadra che calcia.',
      en: 'After the kick deviates, with the ball still in the air, the kicking team rolls.',
    },
    rows: [
      { min: 2, max: 2, name: 'Get the Ref', tone: 'good', text: {
        it: 'Ogni squadra riceve un Bribe gratis, da usare entro la fine della partita.',
        en: 'Each team gets a free Bribe, to be used before the end of the game.',
      } },
      { min: 3, max: 3, name: 'Time-out', tone: 'neutral', text: {
        it: 'Se la squadra che calcia è al turno 6, 7 o 8 della metà, entrambi i segnalini turno arretrano di uno; altrimenti avanzano di uno.',
        en: 'If the kicking team is on turn 6, 7 or 8 of the half, both turn markers go back one space; otherwise both move forward one.',
      } },
      { min: 4, max: 4, name: 'Solid Defence', tone: 'neutral', text: {
        it: 'La squadra che calcia sceglie fino a D3+3 suoi giocatori Open e li rischiera, rispettando le regole di schieramento.',
        en: 'The kicking team picks up to D3+3 of its Open players and sets them up again, following the set-up rules.',
      } },
      { min: 5, max: 5, name: 'High Kick', tone: 'neutral', text: {
        it: 'Un giocatore Open della squadra che riceve può spostarsi subito nella casella dove atterrerà la palla.',
        en: 'One Open player on the receiving team may move straight into the square where the ball will land.',
      } },
      { min: 6, max: 6, name: 'Cheering Fans', tone: 'neutral', text: {
        it: 'Ogni allenatore tira D6 + Cheerleaders. Chi fa di più (entrambi se pari) ha un assist offensivo in più nel primo Block del suo prossimo turno.',
        en: 'Each coach rolls D6 + Cheerleaders. The higher (both on a tie) gets an extra Offensive Assist on the first Block of their next turn.',
      } },
      { min: 7, max: 7, name: 'Brilliant Coaching', tone: 'neutral', text: {
        it: 'Ogni allenatore tira D6 + Assistant Coaches. Chi fa di più (entrambi se pari) ha un Team Re-roll in più per questo drive, perso se non lo usa.',
        en: 'Each coach rolls D6 + Assistant Coaches. The higher (both on a tie) gets a free Team Re-roll for this drive, lost if unused.',
      } },
      { min: 8, max: 8, name: 'Changing Weather', tone: 'neutral', next: 'weather', text: {
        it: 'Si ritira sulla tabella del Meteo. Se esce Perfect Conditions, la palla fa Scatter (3) prima di atterrare.',
        en: 'Roll again on the Weather table. On Perfect Conditions the ball Scatters (3) before landing.',
      } },
      { min: 9, max: 9, name: 'Quick Snap', tone: 'neutral', text: {
        it: 'La squadra che riceve sceglie fino a D3+3 giocatori Open: ognuno si sposta di una casella in qualsiasi direzione, anche nella metà avversaria.',
        en: 'The receiving team picks up to D3+3 Open players: each moves one square in any direction, even into the opposition half.',
      } },
      { min: 10, max: 10, name: 'Charge!', tone: 'neutral', text: {
        it: 'La squadra che calcia sceglie fino a D3+3 giocatori Open e li attiva uno alla volta con un Move gratis; uno può fare invece un Blitz, uno un Throw Team-mate e uno un Kick Team-mate. Se uno cade o viene atterrato, la carica finisce.',
        en: 'The kicking team picks up to D3+3 Open players and activates them one at a time for a free Move; one may Blitz instead, one Throw Team-mate and one Kick Team-mate. If one falls or is knocked down, the charge ends.',
      } },
      { min: 11, max: 11, name: 'Dodgy Snack', tone: 'bad', text: {
        it: 'Ogni allenatore tira un D6; chi fa meno (entrambi se pari) sceglie a caso un suo giocatore in campo e tira un D6: con 2+ ha -1 MA e -1 AV per il drive, con 1 va nelle riserve per il resto del drive.',
        en: 'Each coach rolls a D6; the lower (both on a tie) randomly picks one of their players on the pitch and rolls a D6: on 2+ they get -1 MA and -1 AV for the drive, on a 1 they go to the Reserves for the rest of the drive.',
      } },
      { min: 12, max: 12, name: 'Pitch Invasion', tone: 'bad', text: {
        it: 'Ogni allenatore tira D6 + Fan Factor; chi fa meno (entrambi se pari) sceglie a caso D3 suoi giocatori in campo, che finiscono Prone e Stunned.',
        en: 'Each coach rolls D6 + Fan Factor; the lower (both on a tie) randomly picks D3 of their players on the pitch, who are Placed Prone and Stunned.',
      } },
    ],
  },
  {
    key: 'injury',
    title: { it: 'Infortunio', en: 'Injury' },
    page: 66,
    dice: { count: 2, sides: 6 },
    who: {
      it: 'Quando l\'armatura è rotta, tira l\'allenatore avversario.',
      en: 'When armour is broken, the opposing coach rolls.',
    },
    note: {
      it: 'Per i giocatori con Stunty si usa la tabella Stunty.',
      en: 'Players with Stunty use the Stunty table instead.',
    },
    rows: [
      { min: 2, max: 7, name: 'Stunned', tone: 'neutral', text: {
        it: 'Il giocatore resta in campo, Stunned.',
        en: 'The player stays on the pitch, Stunned.',
      } },
      { min: 8, max: 9, name: 'Knocked-out', tone: 'bad', text: {
        it: 'Il giocatore esce e va nel box Knocked-out della sua panchina.',
        en: 'The player leaves the pitch for the Knocked-out box of their dugout.',
      } },
      { min: 10, max: 12, name: 'Casualty', tone: 'bad', next: 'casualty', text: {
        it: 'Il giocatore va nel box Casualty e l\'avversario tira sulla tabella Casualty.',
        en: 'The player goes to the Casualty box and the opponent rolls on the Casualty table.',
      } },
    ],
  },
  {
    key: 'stunty',
    title: { it: 'Infortunio Stunty', en: 'Stunty injury' },
    page: 66,
    dice: { count: 2, sides: 6 },
    who: {
      it: 'Al posto della tabella Infortunio, per i giocatori con il Trait Stunty.',
      en: 'Instead of the Injury table, for players with the Stunty Trait.',
    },
    rows: [
      { min: 2, max: 6, name: 'Stunned', tone: 'neutral', text: {
        it: 'Il giocatore resta in campo, Stunned.',
        en: 'The player stays on the pitch, Stunned.',
      } },
      { min: 7, max: 8, name: 'Knocked-out', tone: 'bad', text: {
        it: 'Il giocatore esce e va nel box Knocked-out della sua panchina.',
        en: 'The player leaves the pitch for the Knocked-out box of their dugout.',
      } },
      { min: 9, max: 9, name: 'Badly Hurt', tone: 'bad', text: {
        it: 'Casualty. In League Play non si tira sulla tabella Casualty: vale direttamente Badly Hurt.',
        en: 'A Casualty. In League Play there is no Casualty roll: it counts as Badly Hurt.',
      } },
      { min: 10, max: 12, name: 'Casualty', tone: 'bad', next: 'casualty', text: {
        it: 'Il giocatore va nel box Casualty e l\'avversario tira sulla tabella Casualty.',
        en: 'The player goes to the Casualty box and the opponent rolls on the Casualty table.',
      } },
    ],
  },
  {
    key: 'casualty',
    title: { it: 'Casualty', en: 'Casualty' },
    page: 67,
    dice: { count: 1, sides: 16 },
    who: {
      it: 'Tira l\'allenatore avversario. Il giocatore salta comunque il resto della partita.',
      en: 'The opposing coach rolls. The player misses the rest of the game either way.',
    },
    modifier: {
      it: '+1 per ogni Niggling Injury del giocatore',
      en: '+1 for each Niggling Injury the player has',
    },
    note: {
      it: 'Con l\'Apothecary si tira una seconda volta e il proprietario del giocatore sceglie quale risultato tenere; con Badly Hurt torna nelle riserve (p. 68).',
      en: 'With an Apothecary the roll is made again and the player\'s coach picks which result applies; on Badly Hurt they return to the Reserves (p. 68).',
    },
    rows: [
      { min: 1, max: 8, name: 'Badly Hurt', tone: 'neutral', text: {
        it: 'Nessuna conseguenza oltre a questa partita.',
        en: 'No lasting effect beyond this game.',
      } },
      { min: 9, max: 10, name: 'Seriously Hurt', tone: 'bad', text: {
        it: 'Salta la prossima partita.',
        en: 'Misses the next game.',
      } },
      { min: 11, max: 12, name: 'Serious Injury', tone: 'bad', text: {
        it: 'Una Niggling Injury e salta la prossima partita.',
        en: 'A Niggling Injury, and misses the next game.',
      } },
      { min: 13, max: 14, name: 'Lasting Injury', tone: 'bad', next: 'lasting', text: {
        it: 'Perde un punto in una caratteristica (tabella Lasting Injury) e salta la prossima partita.',
        en: 'Loses a point in one characteristic (Lasting Injury table) and misses the next game.',
      } },
      { min: 15, max: 16, name: 'Dead', tone: 'bad', text: {
        it: 'Il giocatore è morto: va tolto dal roster.',
        en: 'The player is dead and leaves the roster.',
      } },
    ],
  },
  {
    key: 'lasting',
    title: { it: 'Lasting Injury', en: 'Lasting Injury' },
    page: 67,
    dice: { count: 1, sides: 6 },
    who: {
      it: 'Dopo un risultato Lasting Injury sulla tabella Casualty.',
      en: 'After a Lasting Injury result on the Casualty table.',
    },
    note: {
      it: 'Se la caratteristica è già al minimo non si riduce, e resta solo il Miss Next Game.',
      en: 'If the characteristic is already at its worst it is not reduced, leaving only Miss Next Game.',
    },
    rows: [
      { min: 1, max: 2, name: 'Head Injury', tone: 'bad', text: { it: '-1 AV (l\'armatura si rompe più facilmente).', en: '-1 AV (armour breaks more easily).' } },
      { min: 3, max: 3, name: 'Smashed Knee', tone: 'bad', text: { it: '-1 MA.', en: '-1 MA.' } },
      { min: 4, max: 4, name: 'Broken Arm', tone: 'bad', text: { it: '-1 PA (il tiro richiesto sale di uno).', en: '-1 PA (the target number goes up by one).' } },
      { min: 5, max: 5, name: 'Dislocated Hip', tone: 'bad', text: { it: '-1 AG (il tiro richiesto sale di uno).', en: '-1 AG (the target number goes up by one).' } },
      { min: 6, max: 6, name: 'Broken Shoulder', tone: 'bad', text: { it: '-1 ST.', en: '-1 ST.' } },
    ],
  },
  {
    key: 'argue',
    title: { it: 'Argue the Call', en: 'Argue the Call' },
    page: 69,
    dice: { count: 1, sides: 6 },
    who: {
      it: 'Quando un tuo giocatore viene espulso, puoi protestare con l\'arbitro.',
      en: 'When one of your players is Sent-off, you may argue with the referee.',
    },
    rows: [
      { min: 1, max: 1, name: 'You\'re Outta Here!', tone: 'bad', text: {
        it: 'Espulso anche l\'allenatore: il giocatore resta fuori e non puoi più protestare per il resto della partita.',
        en: 'The coach is ejected too: the player stays Sent-off and you cannot argue again for the rest of the game.',
      } },
      { min: 2, max: 5, name: 'I Don\'t Care!', tone: 'neutral', text: {
        it: 'L\'arbitro non cambia idea: il giocatore resta espulso.',
        en: 'The referee does not budge: the player stays Sent-off.',
      } },
      { min: 6, max: 6, name: 'Well, When You Put It Like That...', tone: 'good', text: {
        it: 'Il giocatore torna nella sua casella e non è espulso, ma il turnover resta.',
        en: 'The player goes back to their square and is not Sent-off, but the turnover still stands.',
      } },
    ],
  },
  {
    key: 'prayers',
    title: { it: 'Prayers to Nuffle', en: 'Prayers to Nuffle' },
    page: 143,
    dice: { count: 1, sides: 16 },
    who: {
      it: 'Per ogni Prayer comprata come incentivo; si ritira un risultato già uscito alla squadra.',
      en: 'For each Prayer bought as an Inducement; re-roll any result the team already has.',
    },
    note: {
      it: 'Gli effetti durano fino a fine partita. Quando si scelgono giocatori, gli Star Player non si possono mai scegliere.',
      en: 'Effects last until the end of the game. When players are picked, Star Players can never be chosen.',
    },
    rows: [
      { min: 1, max: 1, name: 'Treacherous Trapdoor', tone: 'neutral', text: {
        it: 'Chi entra in una casella Trapdoor tira un D6: con 1 ci cade dentro, con un Injury come se fosse spinto tra la folla; la palla rimbalza da lì.',
        en: 'Anyone entering a Trapdoor square rolls a D6: on a 1 they fall through, with an Injury roll as if pushed into the crowd; the ball bounces from there.',
      } },
      { min: 2, max: 2, name: 'Friends with the Ref', tone: 'good', text: {
        it: 'Nell\'Argue the Call anche il 5 vale come 6.',
        en: 'When you Argue the Call, a 5 also counts as a 6.',
      } },
      { min: 3, max: 3, name: 'Stiletto', tone: 'good', text: {
        it: 'Un tuo giocatore a caso ottiene Stab.',
        en: 'One of your players, picked at random, gains Stab.',
      } },
      { min: 4, max: 4, name: 'Iron Man', tone: 'good', text: {
        it: 'Un tuo giocatore a scelta ottiene +1 AV (massimo 11+).',
        en: 'One of your players of your choice gets +1 AV (up to 11+).',
      } },
      { min: 5, max: 5, name: 'Knuckle Dusters', tone: 'good', text: {
        it: 'Un tuo giocatore a scelta ottiene Mighty Blow.',
        en: 'One of your players of your choice gains Mighty Blow.',
      } },
      { min: 6, max: 6, name: 'Bad Habits', tone: 'good', text: {
        it: 'D3 avversari a caso ottengono Loner (2+).',
        en: 'D3 random opposition players gain Loner (2+).',
      } },
      { min: 7, max: 7, name: 'Greasy Cleats', tone: 'good', text: {
        it: 'Un avversario a caso ha -1 MA (minimo 1).',
        en: 'One random opposition player gets -1 MA (minimum 1).',
      } },
      { min: 8, max: 8, name: 'Blessing of Nuffle', tone: 'good', text: {
        it: 'Un tuo giocatore a caso ottiene Pro.',
        en: 'One of your players, picked at random, gains Pro.',
      } },
      { min: 9, max: 9, name: 'Moles under the Pitch', tone: 'good', text: {
        it: 'Gli avversari hanno -1 a ogni Rush.',
        en: 'Opposition players get -1 to every Rush.',
      } },
      { min: 10, max: 10, name: 'Perfect Passing', tone: 'good', text: {
        it: 'I tuoi passaggi completati valgono 2 SPP invece di 1.',
        en: 'Your completions earn 2 SPP instead of 1.',
      } },
      { min: 11, max: 11, name: 'Dazzling Catching', tone: 'good', text: {
        it: 'Prendere un passaggio vale 1 SPP.',
        en: 'Catching a pass earns 1 SPP.',
      } },
      { min: 12, max: 12, name: 'Fan Interaction', tone: 'good', text: {
        it: 'Se un avversario spinto tra la folla subisce una Casualty, chi l\'ha spinto guadagna 2 SPP.',
        en: 'If an opponent pushed into the crowd suffers a Casualty, the player who pushed them earns 2 SPP.',
      } },
      { min: 13, max: 13, name: 'Fouling Frenzy', tone: 'good', text: {
        it: 'Una Casualty causata con un Foul vale 2 SPP.',
        en: 'A Casualty caused by a Foul earns 2 SPP.',
      } },
      { min: 14, max: 14, name: 'Throw a Rock', tone: 'good', text: {
        it: 'Una volta per partita, a inizio turno prima di attivare giocatori: scegli a caso un avversario in campo e tira un D6; con 4+ è Knocked Down.',
        en: 'Once per game, at the start of your turn before activating anyone: pick a random opponent on the pitch and roll a D6; on a 4+ they are Knocked Down.',
      } },
      { min: 15, max: 15, name: 'Under Scrutiny', tone: 'good', text: {
        it: 'Un avversario che fa un Foul e rompe l\'armatura è sempre espulso, anche senza doppio.',
        en: 'An opponent who Fouls and breaks armour is always Sent-off, even without a double.',
      } },
      { min: 16, max: 16, name: 'Intensive Training', tone: 'good', text: {
        it: 'Un tuo giocatore a caso ottiene una skill Primary a scelta.',
        en: 'One of your players, picked at random, gains a Primary skill of your choice.',
      } },
    ],
  },
];

export const getMatchTable = (key: string | null | undefined) => MATCH_TABLES.find(t => t.key === key) ?? null;

// Tiro vero, non Math.random: con crypto il dado non ha distorsioni
export function rollDie(sides: number) {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;   // scarta la coda per non favorire i numeri bassi
  let value: number;
  do { crypto.getRandomValues(buffer); value = buffer[0]; } while (value >= limit);
  return (value % sides) + 1;
}

export function rollTable(table: MatchTable) {
  return Array.from({ length: table.dice.count }, () => rollDie(table.dice.sides));
}

// Il risultato (con eventuale modificatore) portato dentro la tabella: un D16 + 2 fa comunque "Dead" a 16
export function rowForTotal(table: MatchTable, total: number) {
  const min = table.rows[0].min;
  const max = table.rows[table.rows.length - 1].max;
  const clamped = Math.min(max, Math.max(min, total));
  return table.rows.find(row => clamped >= row.min && clamped <= row.max) ?? null;
}
