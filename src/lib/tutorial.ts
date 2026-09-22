// Contenuti del tutorial "a pillole". Ogni pillola è una schermata sola: testo breve, un diagramma
// (disegnato da noi, vedi src/components/tutorial/TutorialDiagram.tsx) e, se presente, un video in
// public/tutorial/<file>. I riferimenti di pagina rimandano al Rulebook 2025 (Third Season Edition).
//
// Per aggiungere una pillola basta aggiungere un oggetto a un percorso: niente da toccare nelle pagine.

export type Lang = 'it' | 'en';
export type Text = Record<Lang, string>;
export type Paragraphs = Record<Lang, string[]>;

export type Pill = {
  id: string;
  title: Text;
  body: Paragraphs;
  page: string;                 // pagina/e del regolamento
  diagram?: string;             // chiave in TutorialDiagram
  video?: string;               // file in public/tutorial/ (facoltativo)
  link?: { href: string; label: Text };
};

export type QuizQuestion = {
  id: string;
  question: Text;
  options: Text[];
  answer: number;               // indice della risposta corretta
  why: Text;
};

export type Track = {
  id: string;
  number: string;
  title: Text;
  summary: Text;
  pills: Pill[];
  quiz: QuizQuestion[];
};

export const TRACKS: Track[] = [
  // ----------------------------------------------------------------
  {
    id: 'basi',
    number: '01',
    title: { it: 'Le basi', en: 'The basics' },
    summary: {
      it: 'Che partita è, dove si gioca, come è fatto un giocatore e come si tirano i dadi.',
      en: 'What kind of game this is, the pitch, what a player looks like and how dice work.',
    },
    pills: [
      {
        id: 'obiettivo',
        page: 'pp. 44, 80',
        diagram: 'pitch',
        title: { it: 'Vince chi segna di più', en: 'Most touchdowns wins' },
        body: {
          it: [
            'Una partita dura due tempi da otto round ciascuno. In ogni round entrambi gli allenatori giocano un turno, quindi ogni squadra ha otto turni per tempo.',
            'Si segna un Touchdown quando un tuo giocatore in piedi, con la palla in mano, si trova nella End Zone avversaria. A fine partita vince chi ne ha segnati di più; a parità è pareggio.',
            'Sembra poco tempo, ed è il punto: con sedici turni in tutto ogni attivazione conta, e spesso conviene rallentare l\'avversario invece di correre.',
          ],
          en: [
            'A game lasts two halves of eight rounds. In each round both coaches take a turn, so every team gets eight turns per half.',
            'You score a Touchdown when one of your players is Standing with the ball in the opposition End Zone. Whoever scores more wins; equal scores mean a draw.',
            'Sixteen turns is not much, and that is the point: every activation matters, and slowing the opponent down is often better than running.',
          ],
        },
      },
      {
        id: 'campo',
        page: 'p. 23',
        diagram: 'pitch',
        title: { it: 'Il campo', en: 'The pitch' },
        body: {
          it: [
            'Il campo è una griglia di caselle. Alle due estremità corte ci sono le End Zone: è lì che si segna.',
            'Le due fasce laterali lunghe si chiamano Wide Zone e sono larghe quattro caselle; in mezzo c\'è il Centre Field. La linea che divide il campo a metà è la Line of Scrimmage, dove si schierano i giocatori a inizio drive.',
            'Ai bordi lunghi ci sono le Sidelines: chi finisce oltre quelle linee finisce tra il pubblico, che non è gentile.',
          ],
          en: [
            'The pitch is a grid of squares. The two short ends are the End Zones: that is where you score.',
            'The two long strips along the sides are the Wide Zones, four squares wide; between them lies the Centre Field. The line splitting the pitch in half is the Line of Scrimmage, where players set up at the start of a drive.',
            'The long edges are the Sidelines: anyone pushed past them lands among the crowd, and the crowd is not kind.',
          ],
        },
      },
      {
        id: 'profilo',
        page: 'pp. 36-37',
        diagram: 'profile',
        title: { it: 'Il profilo del giocatore', en: 'The player profile' },
        body: {
          it: [
            'Ogni giocatore ha cinque caratteristiche. MA è quante caselle si muove. ST è la forza, usata nei blocchi. AG, PA e AV sono numeri bersaglio: si tira un D6 e bisogna fare almeno quel numero.',
            'AG serve per schivare, raccogliere e prendere la palla. PA per passare. AV è l\'armatura: più è basso il numero, più è facile romperla per l\'avversario.',
            'Sotto le caratteristiche ci sono skill e tratti, e le keyword (razza, ruolo). Nessuna caratteristica può migliorare più di due volte, né superare i limiti: MA 9, ST 8, AG 1+, PA 1+, AV 11+.',
          ],
          en: [
            'Every player has five characteristics. MA is how many squares they move. ST is strength, used when blocking. AG, PA and AV are target numbers: roll a D6 and match or beat them.',
            'AG covers dodging, picking up and catching the ball. PA is for passing. AV is armour: the lower the number, the easier it is for the opponent to break.',
            'Below the characteristics sit skills, traits and keywords (race, position). No characteristic can be improved more than twice, nor go past its cap: MA 9, ST 8, AG 1+, PA 1+, AV 11+.',
          ],
        },
      },
      {
        id: 'dadi',
        page: 'pp. 32-33',
        diagram: 'dice',
        title: { it: 'Dadi e re-roll', en: 'Dice and re-rolls' },
        body: {
          it: [
            'Si usano D6, D8, D16 e i dadi da blocco. Quando una regola chiede "3+", va bene qualsiasi risultato da 3 in su.',
            'Un 1 naturale fallisce sempre, un 6 naturale riesce sempre, qualunque siano i modificatori.',
            'I Team Re-roll ripetono un tiro andato male: uno per volta, solo nel proprio turno, e si ricaricano a metà partita. Non si possono usare su armatura, infortunio, casualty, rimbalzi e rimesse.',
          ],
          en: [
            'The game uses D6, D8, D16 and Block dice. When a rule asks for "3+", any result of 3 or more works.',
            'A natural 1 always fails and a natural 6 always succeeds, whatever the modifiers say.',
            'Team Re-rolls let you repeat a bad roll: one at a time, only during your own turn, and they refill at half-time. They cannot be used on armour, injury, casualty, bounces or throw-ins.',
          ],
        },
      },
    ],
    quiz: [
      {
        id: 'q-turni',
        question: { it: 'Quanti turni gioca una squadra in una partita?', en: 'How many turns does a team get in a game?' },
        options: [
          { it: 'Otto in tutto', en: 'Eight in total' },
          { it: 'Sedici: otto per tempo', en: 'Sixteen: eight per half' },
          { it: 'Finché non segna', en: 'Until they score' },
        ],
        answer: 1,
        why: { it: 'Due tempi da otto round, e in ogni round ogni allenatore ha un turno (p. 50).', en: 'Two halves of eight rounds, and each coach takes one turn per round (p. 50).' },
      },
      {
        id: 'q-naturale',
        question: { it: 'Tiri un D6 per un test con +2: esce 1. Cosa succede?', en: 'You roll a D6 for a test with +2 and get a natural 1. What happens?' },
        options: [
          { it: 'Fallisce comunque', en: 'It fails anyway' },
          { it: 'Vale 3, quindi dipende dal bersaglio', en: 'It counts as 3, so it depends on the target' },
          { it: 'Si ritira il dado', en: 'You re-roll the dice' },
        ],
        answer: 0,
        why: { it: 'Un 1 naturale è sempre un fallimento, qualunque modificatore (p. 33).', en: 'A natural 1 is always a failure, whatever the modifiers (p. 33).' },
      },
    ],
  },

  // ----------------------------------------------------------------
  {
    id: 'turno',
    number: '02',
    title: { it: 'Il turno', en: 'The turn' },
    summary: {
      it: 'Attivazioni, azioni dichiarate, movimento, schivate e il temutissimo turnover.',
      en: 'Activations, declared actions, movement, dodges and the dreaded turnover.',
    },
    pills: [
      {
        id: 'struttura',
        page: 'p. 50',
        diagram: 'turnStructure',
        title: { it: 'Round e turni', en: 'Rounds and turns' },
        body: {
          it: [
            'Ogni round contiene un turno per allenatore. Nel round gioca prima chi ha ricevuto il calcio d\'inizio del tempo, poi l\'altro.',
            'Nel secondo tempo si invertono le parti: chi ha ricevuto nel primo tempo calcia. Dopo un Touchdown si ricomincia con un nuovo calcio d\'inizio.',
            'Prima cosa da fare nel proprio turno: spostare il segnaturno. Sembra una sciocchezza, ma è così che entrambi sanno a che turno siete.',
          ],
          en: [
            'Each round holds one turn per coach. The team that received the kick-off for the half plays first, then the other.',
            'In the second half the roles swap: whoever received in the first half now kicks. After a touchdown, a new kick-off starts the next drive.',
            'First thing in your turn: move the turn marker. It sounds trivial, but it is how both coaches know which turn you are on.',
          ],
        },
      },
      {
        id: 'azioni',
        page: 'pp. 50-52',
        diagram: 'actions',
        title: { it: 'Un giocatore, un\'azione', en: 'One player, one action' },
        body: {
          it: [
            'Nel tuo turno attivi i giocatori uno alla volta, ognuno una sola volta. Quando attivi un giocatore dichiari subito che azione fa, e non la puoi cambiare a metà.',
            'Alcune azioni si possono dichiarare una sola volta per turno in tutta la squadra: Blitz, Passaggio, Hand-off, Fallo, Secure the Ball e Throw Team-mate.',
            'Muovere e bloccare invece non hanno limiti: possono farlo tutti, nello stesso turno.',
          ],
          en: [
            'On your turn you activate players one at a time, each once. When you activate a player you declare their action straight away, and cannot change it midway.',
            'Some actions can only be declared once per team per turn: Blitz, Pass, Hand-off, Foul, Secure the Ball and Throw Team-mate.',
            'Moving and blocking have no such limit: every player can do them in the same turn.',
          ],
        },
      },
      {
        id: 'movimento',
        page: 'pp. 54-58',
        diagram: 'tackleZone',
        title: { it: 'Muoversi tra gli avversari', en: 'Moving among opponents' },
        body: {
          it: [
            'Un giocatore in piedi controlla le otto caselle attorno a sé: è la sua Tackle Zone. Se sei dentro la Tackle Zone di un avversario sei "marcato".',
            'Uscire da una casella in cui sei marcato richiede una schivata: test di AG con -1 per ogni avversario che marca la casella in cui entri. Se fallisci cadi e il turno finisce lì.',
            'Alzarsi da terra costa 3 caselle di movimento. Finito il movimento puoi tentare il Rush: massimo due volte, ogni volta un D6, con 1 cadi.',
          ],
          en: [
            'A standing player controls the eight squares around them: their Tackle Zone. If you stand in an opponent\'s Tackle Zone, you are Marked.',
            'Leaving a square where you are Marked means dodging: an AG test with -1 for each opponent marking the square you move into. Fail and you fall over, ending your turn.',
            'Standing up costs 3 squares of movement. Once your movement is spent you may Rush: at most twice, each time a D6, and on a 1 you trip.',
          ],
        },
      },
      {
        id: 'turnover',
        page: 'p. 35',
        diagram: 'turnover',
        title: { it: 'Il turnover', en: 'The turnover' },
        body: {
          it: [
            'Il turnover è il meccanismo che tronca il turno: appena succede, l\'attivazione in corso finisce e il turno passa all\'avversario, anche se avevi ancora dieci giocatori da muovere.',
            'Lo causano soprattutto: un tuo giocatore che cade o viene atterrato nel tuo turno, la palla raccolta male, un passaggio fumbled, una presa fallita, un avversario che intercetta, un fallo scoperto dall\'arbitro.',
            'Anche segnare è un turnover, ma è quello che volevi. Regola pratica: fai prima le cose rischiose, quando hai ancora tutto da giocare, e lascia per ultime quelle sicure.',
          ],
          en: [
            'A turnover cuts your turn short: the moment it happens, the current activation ends and play passes to your opponent, even with ten players still to move.',
            'The usual causes: one of your players falling or being knocked down during your turn, a failed pick-up, a fumbled pass, a dropped catch, an interception, or a foul spotted by the referee.',
            'Scoring is a turnover too, but that one you wanted. Rule of thumb: take the risky actions first, while you still have everything to play, and keep the safe ones for last.',
          ],
        },
      },
    ],
    quiz: [
      {
        id: 'q-blitz',
        question: { it: 'Quanti Blitz può dichiarare una squadra in un turno?', en: 'How many Blitz Actions can a team declare in one turn?' },
        options: [
          { it: 'Uno solo', en: 'Just one' },
          { it: 'Uno per giocatore in piedi', en: 'One per standing player' },
          { it: 'Nessun limite', en: 'No limit' },
        ],
        answer: 0,
        why: { it: 'Blitz, Passaggio, Hand-off, Fallo, Secure the Ball e Throw Team-mate: una volta per turno ciascuno (pp. 51-52).', en: 'Blitz, Pass, Hand-off, Foul, Secure the Ball and Throw Team-mate: once per turn each (pp. 51-52).' },
      },
      {
        id: 'q-dodge',
        question: { it: 'Schivi entrando in una casella marcata da due avversari. Che modificatore hai?', en: 'You dodge into a square marked by two opponents. What modifier applies?' },
        options: [
          { it: '-1, sempre uno solo', en: '-1, always just one' },
          { it: '-2, uno per avversario', en: '-2, one per opponent' },
          { it: 'Nessuno: conta solo chi marca la casella di partenza', en: 'None: only the square you leave matters' },
        ],
        answer: 1,
        why: { it: 'Il test di AG ha -1 per ogni avversario che marca la casella in cui entri (p. 55).', en: 'The AG test takes -1 for each opponent marking the square you move into (p. 55).' },
      },
    ],
  },

  // ----------------------------------------------------------------
  {
    id: 'palla',
    number: '03',
    title: { it: 'La palla', en: 'The ball' },
    summary: {
      it: 'Raccoglierla senza farla scappare, passarla, prenderla e portarla in fondo.',
      en: 'Picking it up, passing it, catching it and carrying it home.',
    },
    pills: [
      {
        id: 'raccogliere',
        page: 'pp. 57, 59',
        diagram: 'pickup',
        title: { it: 'Raccogliere la palla', en: 'Picking up the ball' },
        body: {
          it: [
            'Se entri nella casella della palla devi tentare di raccoglierla: test di AG con -1 per ogni avversario che ti marca. Se fallisci la palla rimbalza e il turno finisce.',
            'C\'è un modo prudente: il Secure the Ball. Si può dichiarare solo se la palla non ha avversari in piedi entro due caselle. Ti muovi, finisci sulla palla e la raccogli con un D6 da 2 in su, ma l\'attivazione finisce lì.',
            'I Big Guy non possono dichiarare Secure the Ball: per loro si va sempre di test di AG.',
          ],
          en: [
            'Move into the ball\'s square and you must try to pick it up: an AG test with -1 for each opponent marking you. Fail and the ball bounces away, ending your turn.',
            'There is a careful option: the Secure the Ball action. You may only declare it if no standing opponent is within two squares of the ball. You move, finish on the ball and pick it up on a D6 roll of 2+, but your activation ends there.',
            'Big Guys cannot declare Secure the Ball: for them it is always the AG test.',
          ],
        },
      },
      {
        id: 'passaggio',
        page: 'pp. 70-71',
        diagram: 'passRanges',
        title: { it: 'Passare', en: 'Passing' },
        body: {
          it: [
            'Un passaggio per turno. Si dichiara la casella bersaglio, si misura la distanza e si ottiene una delle quattro gittate: Quick Pass, Short Pass, Long Pass, Long Bomb.',
            'Poi test di PA con il modificatore della gittata: 0, -1, -2, -3. In più -1 per ogni avversario che marca chi lancia.',
            'Test superato o 6 naturale: passaggio preciso, la palla arriva dove volevi. Fallito: passaggio impreciso, la palla devia di tre caselle. Risultato di 1: la palla ti scivola di mano ed è turnover.',
          ],
          en: [
            'One pass per turn. Declare the target square, measure the distance and you get one of four ranges: Quick Pass, Short Pass, Long Pass, Long Bomb.',
            'Then a PA test with the range modifier: 0, -1, -2, -3. On top of that, -1 for each opponent marking the thrower.',
            'Pass the test or roll a natural 6: accurate pass, the ball lands where you wanted. Fail: inaccurate pass, the ball scatters three squares. A result of 1: fumble, and that is a turnover.',
          ],
        },
      },
      {
        id: 'presa',
        page: 'pp. 71-72',
        diagram: 'catch',
        title: { it: 'Prendere e intercettare', en: 'Catching and intercepting' },
        body: {
          it: [
            'Prima che la palla arrivi, un avversario in piedi sotto la traiettoria può tentare l\'intercetto: test di AG con -3 se il passaggio è preciso, -2 se impreciso, e -1 per ogni avversario che lo marca. Se riesce, palla sua e turnover.',
            'Chi riceve fa un test di AG: -1 se la palla è rimbalzata, -1 se è una rimessa dal pubblico, -1 per ogni avversario che lo marca.',
            'Presa fallita: la palla rimbalza di una casella. Chi è a terra o distratto non può prendere: la palla rimbalza e basta.',
          ],
          en: [
            'Before the ball arrives, a standing opponent under the throw may try to intercept: an AG test at -3 against an accurate pass, -2 against an inaccurate one, and -1 for each opponent marking them. Success means they take the ball and you get a turnover.',
            'The receiver then makes an AG test: -1 if the ball bounced, -1 if it was thrown in by the crowd, -1 for each opponent marking them.',
            'A failed catch bounces the ball one square. Players who are down or distracted cannot catch at all: the ball simply bounces.',
          ],
        },
      },
      {
        id: 'touchdown',
        page: 'pp. 80-81',
        diagram: 'touchdown',
        title: { it: 'Segnare (e lo Stalling)', en: 'Scoring (and Stalling)' },
        body: {
          it: [
            'Per segnare bisogna essere in piedi, con la palla, in una casella della End Zone avversaria. Si può segnare anche durante il turno dell\'avversario, per esempio se ti spingono dentro mentre hai la palla.',
            'Segnare chiude il drive: si torna a schierarsi e chi ha segnato calcia.',
            'Attenzione allo Stalling: se un tuo giocatore potrebbe segnare senza tirare nemmeno un dado e non lo fa, a fine attivazione tira un D6. Se esce un risultato pari o superiore al numero del turno, il pubblico gli tira addosso qualcosa: atterrato e turnover.',
          ],
          en: [
            'To score you must be standing, holding the ball, in a square of the opposition End Zone. You can even score during your opponent\'s turn, for instance if they push you in while you carry the ball.',
            'Scoring ends the drive: both teams set up again and the scoring team kicks off.',
            'Watch out for Stalling: if one of your players could score without rolling a single dice and does not, roll a D6 at the end of their activation. On a result equal to or higher than the current turn number, the crowd pelts them: knocked down, and a turnover.',
          ],
        },
      },
    ],
    quiz: [
      {
        id: 'q-fumble',
        question: { it: 'Il test di passaggio dà 1 dopo i modificatori. Che succede?', en: 'Your passing test comes out as 1 after modifiers. What happens?' },
        options: [
          { it: 'Passaggio impreciso: la palla devia', en: 'Inaccurate pass: the ball scatters' },
          { it: 'Fumble: la palla cade e il turno finisce', en: 'Fumble: the ball drops and the turn ends' },
          { it: 'Il ricevitore prende con -1', en: 'The receiver catches at -1' },
        ],
        answer: 1,
        why: { it: 'Con 1 dopo i modificatori (o un 1 naturale) il passaggio è fumbled: rimbalzo e turnover (p. 71).', en: 'A 1 after modifiers (or a natural 1) is a fumbled pass: the ball bounces and it is a turnover (p. 71).' },
      },
      {
        id: 'q-secure',
        question: { it: 'Quando puoi dichiarare Secure the Ball?', en: 'When can you declare a Secure the Ball action?' },
        options: [
          { it: 'Sempre, al posto del test di AG', en: 'Always, instead of the AG test' },
          { it: 'Solo se nessun avversario in piedi è entro due caselle dalla palla', en: 'Only if no standing opponent is within two squares of the ball' },
          { it: 'Solo nella tua metà campo', en: 'Only in your own half' },
        ],
        answer: 1,
        why: { it: 'Serve palla libera e nessun avversario in piedi entro due caselle; poi si raccoglie con 2+ e l\'attivazione finisce (p. 59).', en: 'The ball must be loose with no standing opponent within two squares; you then pick it up on a 2+ and your activation ends (p. 59).' },
      },
    ],
  },

  // ----------------------------------------------------------------
  {
    id: 'legnate',
    number: '04',
    title: { it: 'Le legnate', en: 'The violence' },
    summary: {
      it: 'Blocchi, assistenze, armatura, infortuni e l\'arte di dare calci quando l\'arbitro guarda altrove.',
      en: 'Blocks, assists, armour, injuries and the art of kicking while the referee looks away.',
    },
    pills: [
      {
        id: 'blocco',
        page: 'pp. 60-62',
        diagram: 'blockDice',
        title: { it: 'Il blocco', en: 'The block' },
        body: {
          it: [
            'Blocchi un avversario in piedi che stai marcando. Il numero di dadi dipende dalla forza: pari forza un dado, se sei più forte due, se hai più del doppio della sua forza tre.',
            'Sceglie il risultato l\'allenatore del giocatore più forte; a forze pari sceglie chi ha tirato.',
            'Le facce sono cinque: Player Down (cadi tu), Both Down (cadete entrambi), Push Back (lo spingi indietro), Stumble (vale Push Back se il bersaglio ha Dodge, altrimenti POW) e POW (spinta e atterrato).',
          ],
          en: [
            'You block a standing opponent you are marking. The number of dice depends on strength: equal strength one die, stronger two, more than double three.',
            'The stronger player\'s coach picks the result; with equal strength the roller picks.',
            'There are five faces: Player Down (you fall), Both Down (both fall), Push Back (you shove them), Stumble (counts as Push Back if the target has Dodge, otherwise POW) and POW (push plus knocked down).',
          ],
        },
      },
      {
        id: 'assist',
        page: 'p. 61',
        diagram: 'assists',
        title: { it: 'Le assistenze', en: 'Assists' },
        body: {
          it: [
            'La forza si modifica con le assistenze. Un compagno che marca il bersaglio e non è marcato da nessun altro avversario ti dà +1: è un\'assistenza offensiva.',
            'Allo stesso modo, i compagni del bersaglio che marcano te e non sono marcati da altri danno +1 a lui: assistenza difensiva.',
            'Ecco perché in Blood Bowl si gioca a gruppi: due giocatori normali che accerchiano un avversario picchiano meglio di un mostro isolato.',
          ],
          en: [
            'Strength is modified by assists. A team-mate marking the target who is not marked by any other opponent gives you +1: an offensive assist.',
            'The same works the other way: the target\'s team-mates marking you, and not marked by anyone else, give the target +1 as a defensive assist.',
            'That is why Blood Bowl is played in clumps: two ordinary players surrounding an opponent hit harder than one lonely monster.',
          ],
        },
      },
      {
        id: 'infortuni',
        page: 'pp. 66-68',
        diagram: 'injuryChain',
        title: { it: 'Armatura e infortuni', en: 'Armour and injuries' },
        body: {
          it: [
            'Quando un giocatore viene atterrato, l\'avversario tira 2D6 contro la sua AV. Se non la supera, tutto finisce lì: il giocatore è solo a terra.',
            'Se l\'armatura si rompe si tira l\'infortunio con 2D6: 2-7 stordito, 8-9 KO (esce dal campo e può rientrare al drive dopo), 10-12 Casualty.',
            'La Casualty si tira con un D16: 1-8 Badly Hurt (nessuna conseguenza), 9-10 Seriously Hurt, 11-12 Serious Injury (Niggling Injury), 13-14 Lasting Injury (una caratteristica in meno), 15-16 morto. Dal 9 in su, in lega, salta anche la partita successiva.',
          ],
          en: [
            'When a player is knocked down, the opponent rolls 2D6 against their AV. If it does not beat the armour, nothing happens: the player is simply down.',
            'If the armour breaks, roll 2D6 for injury: 2-7 stunned, 8-9 knocked out (off the pitch, may return next drive), 10-12 a Casualty.',
            'Casualties use a D16: 1-8 Badly Hurt (no lasting effect), 9-10 Seriously Hurt, 11-12 Serious Injury (a Niggling Injury), 13-14 Lasting Injury (a characteristic reduced), 15-16 dead. From 9 upwards, in league play, the player also misses the next game.',
          ],
        },
        link: { href: '/tutorial/lega', label: { it: 'Cosa comporta in lega', en: 'What it means in a league' } },
      },
      {
        id: 'fallo',
        page: 'p. 69',
        diagram: 'foul',
        title: { it: 'Il fallo', en: 'The foul' },
        body: {
          it: [
            'Un fallo per turno. Ci si muove fino ad arrivare accanto a un avversario a terra o stordito e gli si tira un calcio: tiro armatura con le assistenze, +1 per ogni assistenza offensiva e -1 per ogni difensiva.',
            'Se esce un doppio sul tiro armatura o su quello infortunio, l\'arbitro se ne accorge: giocatore espulso e turnover.',
            'Puoi protestare (Argue the Call) con un D6: con 1 l\'arbitro caccia anche te per il resto della partita, con 2-5 non cambia nulla, con 6 il giocatore resta in campo (ma il turnover c\'è lo stesso).',
          ],
          en: [
            'One foul per turn. Move next to an opponent who is prone or stunned and put the boot in: an armour roll with assists, +1 for each offensive assist and -1 for each defensive one.',
            'Roll a double on either the armour or the injury roll and the referee notices: the player is sent off and you suffer a turnover.',
            'You may Argue the Call with a D6: on a 1 the referee throws you out too for the rest of the game, on 2-5 nothing changes, on a 6 the player stays on the pitch (though the turnover still stands).',
          ],
        },
      },
    ],
    quiz: [
      {
        id: 'q-dadi-blocco',
        question: { it: 'ST 4 contro ST 3, senza assistenze: quanti dadi e chi sceglie?', en: 'ST 4 against ST 3, no assists: how many dice and who picks?' },
        options: [
          { it: 'Due dadi, sceglie chi blocca', en: 'Two dice, the blocker picks' },
          { it: 'Due dadi, sceglie il bersaglio', en: 'Two dice, the target picks' },
          { it: 'Tre dadi, sceglie chi blocca', en: 'Three dice, the blocker picks' },
        ],
        answer: 0,
        why: { it: 'Forza superiore ma non più del doppio: due dadi, e sceglie sempre il più forte (p. 60).', en: 'Higher strength but not more than double: two dice, and the stronger player always picks (p. 60).' },
      },
      {
        id: 'q-casualty',
        question: { it: 'Tiro infortunio 2D6: quale risultato porta a una Casualty?', en: 'Injury roll on 2D6: which result causes a Casualty?' },
        options: [
          { it: '8-9', en: '8-9' },
          { it: '10-12', en: '10-12' },
          { it: 'Qualsiasi doppio', en: 'Any double' },
        ],
        answer: 1,
        why: { it: '2-7 stordito, 8-9 KO, 10-12 Casualty, poi si tira il D16 sulla tabella (p. 66).', en: '2-7 stunned, 8-9 knocked out, 10-12 a Casualty, then roll the D16 table (p. 66).' },
      },
    ],
  },

  // ----------------------------------------------------------------
  {
    id: 'lega',
    number: '05',
    title: { it: 'La lega', en: 'The league' },
    summary: {
      it: 'Quello che succede prima, dopo e tra le partite: esperienza, soldi, infortuni e incentivi.',
      en: 'What happens before, after and between games: experience, money, injuries and inducements.',
    },
    pills: [
      {
        id: 'spp',
        page: 'pp. 96-98',
        diagram: 'sppTable',
        title: { it: 'SPP e avanzamenti', en: 'SPP and advancements' },
        body: {
          it: [
            'Durante la partita i giocatori guadagnano Star Player Points: 3 per un touchdown, 2 per una Casualty causata bloccando, 2 per un intercetto, 1 per un passaggio completato, 1 al lanciatore di un compagno atterrato bene e 1 a chi è stato lanciato. A fine partita ogni allenatore assegna un MVP, che vale 4 SPP.',
            'Con gli SPP si comprano avanzamenti: una skill primaria a caso (la più economica), una primaria scelta, una secondaria scelta oppure il miglioramento di una caratteristica (il più caro). I prezzi salgono a ogni avanzamento, e sei è il massimo.',
            'La skill casuale si tira sulla Skill Table due volte e si sceglie uno dei due risultati. Per la caratteristica si tira un D8: la tabella dice quali puoi migliorare, e nessuna si può migliorare più di due volte.',
          ],
          en: [
            'During a game players earn Star Player Points: 3 for a touchdown, 2 for a Casualty caused by blocking, 2 for an interception, 1 for a completed pass, 1 for throwing a team-mate who lands safely and 1 for being thrown. After the game each coach awards an MVP, worth 4 SPP.',
            'SPP buy advancements: a random primary skill (the cheapest), a chosen primary, a chosen secondary, or a characteristic improvement (the dearest). Prices rise with each advancement, and six is the maximum.',
            'A random skill is rolled twice on the Skill Table and you pick one of the two. A characteristic needs a D8 roll: the table says which ones you may improve, and none can be improved more than twice.',
          ],
        },
        link: { href: '/teams', label: { it: 'Guarda i roster della lega', en: 'See the league rosters' } },
      },
      {
        id: 'prepartita',
        page: 'pp. 45, 94',
        diagram: 'pettyCash',
        title: { it: 'Prima della partita', en: 'Before the game' },
        body: {
          it: [
            'Ogni squadra tira un D3 di tifosi occasionali e lo somma ai propri Dedicated Fans: è il Fan Factor della giornata, che poi decide gli incassi.',
            'Se una squadra ha meno di undici giocatori disponibili, prende dei Journeymen: Lineman prestati per la partita, con Loner.',
            'Poi si comprano gli incentivi. Chi ha il CTV più alto spende per prima dalla propria cassa; l\'altra riceve Petty Cash pari alla differenza di CTV più quanto ha speso la rivale, e può aggiungere al massimo 50.000 dalla cassa. A CTV pari nessuna delle due compra niente.',
          ],
          en: [
            'Each team rolls a D3 of fair-weather fans and adds it to its Dedicated Fans: that is the day\'s Fan Factor, which later drives the winnings.',
            'If a team has fewer than eleven available players, it takes on Journeymen: linemen on loan for the game, with Loner.',
            'Then come the inducements. The team with the higher CTV spends from its treasury first; the other gets Petty Cash equal to the CTV difference plus whatever the rival spent, and may add at most 50,000 from its own treasury. With equal CTV, neither team buys anything.',
          ],
        },
        link: { href: '/schedule', label: { it: 'Apri il calendario', en: 'Open the schedule' } },
      },
      {
        id: 'incassi',
        page: 'pp. 95-96',
        diagram: 'winnings',
        title: { it: 'Incassi e tifosi', en: 'Winnings and fans' },
        body: {
          it: [
            'L\'incasso si calcola così: metà della Fan Attendance (i Fan Factor delle due squadre sommati), più i touchdown segnati, più 1 se nessuno dei tuoi ha fatto Stalling. Il totale si moltiplica per 10.000.',
            'Poi si aggiornano i Dedicated Fans: se hai vinto tiri un D6 e con un risultato pari o superiore ai tuoi fan ne guadagni uno (massimo 7). Se hai perso, con un risultato inferiore ne perdi uno (minimo 1). In caso di pareggio non cambia nulla.',
            'Nell\'app tutto questo è automatico: basta inserire i tiri nel referto.',
          ],
          en: [
            'Winnings work like this: half the Fan Attendance (both teams\' Fan Factors added together), plus the touchdowns you scored, plus 1 if none of your players was Stalling. Multiply the total by 10,000.',
            'Then update Dedicated Fans: if you won, roll a D6 and on a result equal to or higher than your current fans you gain one (maximum 7). If you lost, a result below your fans costs you one (minimum 1). A draw changes nothing.',
            'In the app this is automatic: you just enter the rolls in the match report.',
          ],
        },
      },
      {
        id: 'infortuni-lega',
        page: 'pp. 67, 99',
        diagram: 'injuryLeague',
        title: { it: 'Infortuni tra una partita e l\'altra', en: 'Injuries between games' },
        body: {
          it: [
            'Chi subisce una Casualty da Seriously Hurt in su salta la partita successiva. Nell\'app compare come MNG e torna disponibile da solo quando quella partita viene registrata.',
            'La Serious Injury lascia una Niggling Injury: ogni Niggling dà +1 ai futuri tiri Casualty di quel giocatore, quindi più ne accumula più diventa fragile.',
            'La Lasting Injury toglie un punto a una caratteristica. Chi la subisce può essere messo a riposo per il resto della stagione (Temporarily Retiring): resta in rosa ma non conta nel CTV.',
          ],
          en: [
            'Anyone suffering a Casualty of Seriously Hurt or worse misses the next game. The app flags them as MNG and clears it automatically once that game is recorded.',
            'A Serious Injury leaves a Niggling Injury: each one adds +1 to that player\'s future casualty rolls, so the more they pile up the more fragile the player becomes.',
            'A Lasting Injury knocks a point off a characteristic. That player may be rested for the season (Temporarily Retiring): they stay on the roster but drop out of the CTV.',
          ],
        },
      },
      {
        id: 'postpartita',
        page: 'pp. 95-100',
        diagram: 'postgame',
        title: { it: 'La sequenza post-partita', en: 'The post-game sequence' },
        body: {
          it: [
            'Dopo ogni partita di lega si seguono sei passi in ordine: incassi, aggiornamento dei Dedicated Fans, avanzamenti, ingaggi e licenziamenti, Journeymen, Expensive Mistakes.',
            'Gli Expensive Mistakes sono l\'ultimo passo e colpiscono chi tiene troppo oro in cassa: da 100.000 in su si tira un D6 e più sei ricco più rischi grosso, fino a perdere quasi tutto.',
            'Per questo conviene spendere prima di chiudere la sequenza: giocatori, staff, re-roll. Nell\'app la pagina della squadra ti mostra i passi rimasti e ti fa tirare i dadi al punto giusto.',
          ],
          en: [
            'After every league fixture you follow six steps in order: winnings, Dedicated Fans update, advancements, hiring and firing, Journeymen, Expensive Mistakes.',
            'Expensive Mistakes come last and punish hoarding: from 100,000 gold upwards you roll a D6, and the richer you are the worse it can get, up to losing nearly everything.',
            'So spend before closing the sequence: players, staff, re-rolls. In the app the team page shows the remaining steps and asks for the rolls at the right moment.',
          ],
        },
        link: { href: '/teams', label: { it: 'Vai alle squadre', en: 'Go to the teams' } },
      },
    ],
    quiz: [
      {
        id: 'q-mvp',
        question: { it: 'Quanti SPP vale l\'MVP?', en: 'How many SPP is the MVP worth?' },
        options: [
          { it: '3', en: '3' },
          { it: '4', en: '4' },
          { it: '5', en: '5' },
        ],
        answer: 1,
        why: { it: 'L\'MVP vale 4 SPP (p. 96). Nelle vecchie edizioni ne valeva 5: è uno degli errori che abbiamo corretto nell\'app.', en: 'The MVP is worth 4 SPP (p. 96). Older editions gave 5: that was one of the bugs we fixed in the app.' },
      },
      {
        id: 'q-petty',
        question: { it: 'La tua squadra ha il CTV più basso di 200.000 e l\'avversaria spende 50.000. Quanta Petty Cash hai?', en: 'Your CTV is 200,000 lower and the opponent spends 50,000. How much Petty Cash do you get?' },
        options: [
          { it: '200.000', en: '200,000' },
          { it: '250.000', en: '250,000' },
          { it: '50.000', en: '50,000' },
        ],
        answer: 1,
        why: { it: 'Differenza di CTV più quanto ha speso l\'altra squadra: 200.000 + 50.000 (p. 94).', en: 'The CTV difference plus whatever the other team spent: 200,000 + 50,000 (p. 94).' },
      },
    ],
  },
];

export const getTrack = (id: string | undefined) => TRACKS.find(t => t.id === id) ?? null;
export const totalPills = TRACKS.reduce((sum, t) => sum + t.pills.length, 0);
