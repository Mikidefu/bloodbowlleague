// Spiegazioni brevi dei termini di gioco e degli incentivi (Rulebook 2025), per i tooltip "?" del percorso guidato.
// Riassunti nostri, non testo del libro.

export type Tip = { it: string; en: string };

const GLOSSARY: Record<string, Tip> = {
  ctv: {
    it: 'Current Team Value: il valore della squadra per questa partita, contando solo chi può giocare (Journeymen compresi). Decide chi riceve gli incentivi.',
    en: 'Current Team Value: the team\'s value for this match, counting only who can play (Journeymen included). It decides who gets inducements.',
  },
  treasury: {
    it: 'La cassa della squadra: gli incassi messi da parte. Paga ingaggi, staff e incentivi.',
    en: 'The team\'s bank: the winnings put aside. It pays for hiring, staff and inducements.',
  },
  'petty cash': {
    it: 'Soldi gratis per gli incentivi alla squadra con il CTV più basso: la differenza di CTV più quanto ha speso l\'avversario. Si può aggiungere fino a 50.000 dalla Treasury.',
    en: 'Free money for inducements for the team with the lower CTV: the CTV difference plus what the opponent spent. Up to 50,000 more can come from the Treasury.',
  },
  journeymen: {
    it: 'Giocatori a gettone presi gratis per arrivare a 11. Sono Lineman con Loner (4+); dopo la partita si possono ingaggiare.',
    en: 'Stand-in players taken for free to reach 11. They are Linemen with Loner (4+); after the match they can be hired.',
  },
  'fan factor': {
    it: 'Dedicated Fans più il D3 dei Fair-weather Fans. Conta per gli incassi e per alcuni eventi di Kick-off.',
    en: 'Dedicated Fans plus the Fair-weather Fans D3. It counts for the winnings and some Kick-off events.',
  },
  'fair-weather fans': {
    it: 'Tifosi occasionali: un D3 che si aggiunge ai Dedicated Fans solo per questa partita.',
    en: 'Casual supporters: a D3 added to Dedicated Fans for this match only.',
  },
  'dedicated fans': {
    it: 'I tifosi fedeli della squadra. Dopo ogni partita possono salire o scendere di uno, in base al risultato e a un D6.',
    en: 'The team\'s loyal supporters. After each match they may go up or down by one, depending on the result and a D6.',
  },
  'fan attendance': {
    it: 'Il pubblico della partita: la somma dei Fan Factor delle due squadre.',
    en: 'The match crowd: both teams\' Fan Factors added together.',
  },
  spp: {
    it: 'Star Player Points: l\'esperienza dei giocatori. Si spendono per skill e miglioramenti.',
    en: 'Star Player Points: the players\' experience. They are spent on skills and improvements.',
  },
  td: { it: 'Touchdown: 3 SPP a chi segna.', en: 'Touchdown: 3 SPP to the scorer.' },
  cas: {
    it: 'Casualty causata con un Block (o con la sua skill durante un Block): 2 SPP. Falli e spinte fuori dal campo non contano.',
    en: 'Casualty caused by a Block (or a skill used during a Block): 2 SPP. Fouls and crowd pushes do not count.',
  },
  int: { it: 'Intercetto riuscito: 2 SPP.', en: 'Successful interception: 2 SPP.' },
  cmp: { it: 'Passaggio completato, preso da un compagno: 1 SPP a chi lancia.', en: 'Completed pass, caught by a team-mate: 1 SPP to the thrower.' },
  ttm: {
    it: 'Throw Team-mate con Superb Throw e compagno atterrato in piedi: 1 SPP a chi lancia.',
    en: 'Throw Team-mate with a Superb Throw and the team-mate landing on their feet: 1 SPP to the thrower.',
  },
  att: { it: 'Atterraggio: lanciato da un compagno, atterra in piedi. 1 SPP.', en: 'Landing: thrown by a team-mate, lands on their feet. 1 SPP.' },
  land: { it: 'Atterraggio: lanciato da un compagno, atterra in piedi. 1 SPP.', en: 'Landing: thrown by a team-mate, lands on their feet. 1 SPP.' },
  mvp: { it: 'Most Valuable Player: 4 SPP a un giocatore per squadra, estratto a fine partita.', en: 'Most Valuable Player: 4 SPP to one player per team, drawn after the match.' },
  stalling: {
    it: 'Temporeggiare con la palla invece di segnare, per far passare il tempo. Se qualcuno l\'ha fatto, gli incassi non hanno il +1.',
    en: 'Sitting on the ball instead of scoring, to run the clock. If anyone did it, the winnings lose the +1.',
  },
  'expensive mistakes': {
    it: 'Con 100.000 gp o più in Treasury si tira un D6: più oro c\'è, più è facile perderne una parte.',
    en: 'With 100,000 gp or more in the Treasury you roll a D6: the more gold, the easier it is to lose some.',
  },
  'crisis averted': { it: 'Nessuna perdita: la Treasury resta com\'è.', en: 'No loss: the Treasury stays as it is.' },
  'minor incident': { it: 'Si perdono D3 x 10.000 gp.', en: 'Lose D3 x 10,000 gp.' },
  'major incident': { it: 'Si perde metà della Treasury.', en: 'Lose half the Treasury.' },
  catastrophe: { it: 'Della Treasury restano solo 2D6 x 10.000 gp.', en: 'Only 2D6 x 10,000 gp of the Treasury remain.' },
  'casualty table': {
    it: 'Tabella degli infortuni gravi: D16 più 1 per ogni Niggling Injury già subita. 1-8 Badly Hurt, 9-10 Seriously Hurt, 11-12 Serious Injury, 13-14 Lasting Injury, 15-16 Dead.',
    en: 'The serious injuries table: D16 plus 1 per Niggling Injury already suffered. 1-8 Badly Hurt, 9-10 Seriously Hurt, 11-12 Serious Injury, 13-14 Lasting Injury, 15-16 Dead.',
  },
  casualty: { it: 'Un giocatore infortunato che esce dal campo e tira sulla Casualty Table.', en: 'A player injured and removed from the pitch, who rolls on the Casualty Table.' },
  'badly hurt': { it: 'Fuori per il resto della partita, nessun effetto dopo.', en: 'Out for the rest of the match, no lasting effect.' },
  'seriously hurt': { it: 'Salta la prossima partita (MNG).', en: 'Misses the next game (MNG).' },
  'serious injury': { it: 'Salta la prossima partita e prende una Niggling Injury.', en: 'Misses the next game and gains a Niggling Injury.' },
  'lasting injury': { it: 'Salta la prossima partita e perde 1 punto in una caratteristica (D6).', en: 'Misses the next game and loses 1 point in a characteristic (D6).' },
  dead: { it: 'Il giocatore muore e lascia la squadra.', en: 'The player dies and leaves the team.' },
  'niggling injury': { it: 'Acciacco permanente: +1 a ogni futuro tiro sulla Casualty Table.', en: 'Permanent ailment: +1 to every future Casualty Table roll.' },
  'getting even': {
    it: 'Dopo un SH, SI o LI si tira un D6: con 4+ il giocatore ottiene Hatred verso una keyword di chi l\'ha infortunato.',
    en: 'After SH, SI or LI roll a D6: on a 4+ the player gains Hatred towards a keyword of whoever injured them.',
  },
  hatred: { it: 'Odio verso una keyword (es. Orc): il giocatore ne trae vantaggio contro quei giocatori.', en: 'Hatred of a keyword (e.g. Orc): the player gets a bonus against those players.' },
  apothecary: { it: 'Il medico della squadra: una volta per partita fa ritirare un infortunio.', en: 'The team medic: once per match lets you re-roll an injury.' },
  regeneration: { it: 'Trait: dopo una Casualty, con un tiro riuscito il giocatore guarisce e va nelle riserve.', en: 'A trait: after a Casualty, on a successful roll the player recovers and goes to the reserves.' },
  stunty: { it: 'Giocatori piccoli: usano una tabella degli infortuni tutta loro.', en: 'Small players: they use their own injury table.' },
  'loner (4+)': { it: 'Per usare un re-roll di squadra deve prima fare 4+ su un D6.', en: 'To use a team re-roll they must first roll a 4+ on a D6.' },
  'team captain': { it: 'Il capitano della squadra, per le squadre con questa regola speciale. Se muore se ne nomina un altro.', en: 'The team captain, for teams with this special rule. If they die a new one is appointed.' },
  'characteristic improvement': { it: 'Miglioramento di una caratteristica (MA, ST, AG, PA, AV): l\'avanzamento più costoso in SPP.', en: 'Improvement of a characteristic (MA, ST, AG, PA, AV): the most expensive advancement in SPP.' },
  'concede without penalty': { it: 'Concessione senza penalità: solo se chi concede non può più schierare giocatori.', en: 'Conceding without penalty: only if the conceding team can no longer field players.' },
  'roll-off': { it: 'Ogni allenatore tira un D6: vince il più alto, con il pareggio si ritira.', en: 'Each coach rolls a D6: the higher wins, on a tie roll again.' },
  'star player': { it: 'Leggende a pagamento per una sola partita. Non guadagnano SPP e non possono essere MVP.', en: 'Legends hired for one match. They earn no SPP and cannot be MVP.' },
  'star players': { it: 'Leggende a pagamento per una sola partita. Non guadagnano SPP e non possono essere MVP.', en: 'Legends hired for one match. They earn no SPP and cannot be MVP.' },
  mercenario: { it: 'Un giocatore del tuo roster preso per una partita: costa il suo prezzo più 30.000 e ha Loner (4+).', en: 'A player from your roster hired for one match: their cost plus 30,000, with Loner (4+).' },
  mercenary: { it: 'Un giocatore del tuo roster preso per una partita: costa il suo prezzo più 30.000 e ha Loner (4+).', en: 'A player from your roster hired for one match: their cost plus 30,000, with Loner (4+).' },
  'pitch invasion': { it: 'Evento di Kick-off: i tifosi invadono il campo e possono stendere dei giocatori. Conta il Fan Factor.', en: 'Kick-off event: fans storm the pitch and may knock players over. Fan Factor matters.' },
  'kick-off event': { it: 'Tiro di 2D6 a ogni calcio d\'inizio: può cambiare meteo, dare re-roll, scatenare il pubblico...', en: '2D6 roll at every kick-off: it can change the weather, grant re-rolls, rile up the crowd...' },
  meteo: { it: 'Il tempo della partita (2D6): dal caldo torrido alla bufera, cambia i tiri in campo.', en: 'The match weather (2D6): from sweltering heat to blizzard, it changes rolls on the pitch.' },
  weather: { it: 'Il tempo della partita (2D6): dal caldo torrido alla bufera, cambia i tiri in campo.', en: 'The match weather (2D6): from sweltering heat to blizzard, it changes rolls on the pitch.' },
  block: { it: 'L\'azione di placcaggio: si tirano i dadi Block contro un avversario adiacente.', en: 'The tackling action: block dice are rolled against an adjacent opponent.' },
  'throw team-mate': { it: 'Un giocatore grosso lancia un compagno piccolo (es. un Goblin).', en: 'A big player throws a small team-mate (e.g. a Goblin).' },
  'argue the call': { it: 'Protestare con l\'arbitro dopo un\'espulsione: D6, con un 6 il giocatore resta.', en: 'Arguing with the ref after a send-off: D6, on a 6 the player stays.' },
  'riotous rookies': { it: 'Squadre con Low Cost Linemen: 2D3+1 Journeymen in più per questa partita.', en: 'Teams with Low Cost Linemen: 2D3+1 extra Journeymen for this match.' },
  d3: { it: 'Dado da 3: si usa un D6 e si dimezza (1-2 = 1, 3-4 = 2, 5-6 = 3).', en: '3-sided die: roll a D6 and halve it (1-2 = 1, 3-4 = 2, 5-6 = 3).' },
  d16: { it: 'Dado da 16 facce, per la Casualty Table e le Prayers to Nuffle.', en: '16-sided die, for the Casualty Table and Prayers to Nuffle.' },
};

// Cosa fa ogni incentivo (pp. 142-149)
export const INDUCEMENT_TIPS: Record<string, Tip> = {
  prayers: {
    it: 'Per ogni preghiera tiri un D16 sulla tabella Prayers to Nuffle (senza doppioni): un effetto a sorpresa che dura tutta la partita.',
    en: 'For each prayer roll a D16 on the Prayers to Nuffle table (no repeats): a surprise effect lasting the whole match.',
  },
  part_time_assistant_coaches: {
    it: '+1 Assistant Coach per questa partita, per ognuno comprato. Aiuta nei Kick-off come Brilliant Coaching.',
    en: '+1 Assistant Coach for this match for each one bought. Helps with Kick-off events such as Brilliant Coaching.',
  },
  temp_agency_cheerleaders: {
    it: '+1 Cheerleader per questa partita, per ognuna comprata. Aiuta nel Kick-off Cheering Fans.',
    en: '+1 Cheerleader for this match for each one bought. Helps with the Cheering Fans Kick-off event.',
  },
  team_mascot: {
    it: 'Un re-roll di squadra in più a tempo, ma prima di usarlo tiri un D6: con 1-3 la mascotte fa cilecca e il re-roll è perso. Può anche ritirare un 1 sul Cheering Fans.',
    en: 'One extra team re-roll per half, but before using it roll a D6: on 1-3 the mascot flops and the re-roll is lost. It can also re-roll a 1 on Cheering Fans.',
  },
  weather_mage: {
    it: 'Una volta per partita, all\'inizio di un tuo turno, ritiri il Meteo con un modificatore da -2 a +2 a tua scelta.',
    en: 'Once per match, at the start of one of your turns, re-roll the Weather with a modifier from -2 to +2 of your choice.',
  },
  blitzers_best_kegs: {
    it: 'La birra che rimette in piedi: +1 per ogni barile al tiro per far rientrare i giocatori KO.',
    en: 'The beer that gets them back up: +1 per keg to the roll to recover Knocked-out players.',
  },
  bribes: {
    it: 'Quando un tuo giocatore viene espulso, dopo aver protestato, usi una Bribe: con 2+ sul D6 resta in campo (e niente Turnover). Con un 1 l\'arbitro si tiene i soldi e lo espelle lo stesso.',
    en: 'When one of your players is Sent-off, after arguing the call, use a Bribe: on a 2+ on the D6 they stay (and no Turnover). On a 1 the ref pockets it and sends them off anyway.',
  },
  extra_team_training: { it: 'Un re-roll di squadra in più per tutta la partita, per ogni allenamento comprato.', en: 'One extra team re-roll for the whole match for each session bought.' },
  mortuary_assistant: { it: 'Una volta per partita ritiri un tiro di Regeneration fallito.', en: 'Once per match re-roll a failed Regeneration roll.' },
  plague_doctor: {
    it: 'Una volta per partita ritiri un tiro di Regeneration fallito, oppure lo usi come un Apothecary.',
    en: 'Once per match re-roll a failed Regeneration roll, or use them as an Apothecary.',
  },
  riotous_rookies: {
    it: 'Dopo i Journeymen normali ne arrivano altri 2D3+1 per questa partita, anche oltre i 16 giocatori.',
    en: 'After the normal Journeymen, 2D3+1 more arrive for this match, even beyond 16 players.',
  },
  wandering_apothecary: { it: 'Un Apothecary in più, da usare una volta nella partita come quello normale.', en: 'An extra Apothecary, used once in the match like a regular one.' },
  halfling_master_chef: {
    it: 'A inizio di ogni tempo tiri 3D6: per ogni 4+ guadagni un re-roll di squadra e l\'avversario ne perde uno.',
    en: 'At the start of each half roll 3D6: for each 4+ you gain a team re-roll and the opponent loses one.',
  },
  dodgy_league_rep: {
    it: 'Arbitro di parte. Quando un avversario fa un fallo e non viene espulso, con 5+ sul D6 lo espelle. E +1 quando protesti (Argue the Call).',
    en: 'A biased referee. When an opponent fouls and is not sent off, on a 5+ on a D6 they are. And +1 when you Argue the Call.',
  },
  josef_bugman: {
    it: '+1 al tiro per far rientrare i KO. Una volta per partita, dopo lo schieramento, rischieri D3 giocatori. Poi non puoi prenderlo come Star Player.',
    en: '+1 to recover Knocked-out players. Once per match, after setting up, re-deploy D3 players. You then cannot hire him as a Star Player.',
  },
  sports_wizard: {
    it: 'Una volta per partita lancia Fireball (4+ su un D6 stende chi è nell\'area) oppure Zap! (trasforma un giocatore in rana fino a fine drive).',
    en: 'Once per match casts Fireball (a 4+ on a D6 knocks down those in the area) or Zap! (turns a player into a frog until the end of the drive).',
  },
  mercenary: {
    it: 'Un giocatore del tuo roster per una sola partita: costa il suo prezzo più 30.000 (più 50.000 per una skill primaria). Ha Loner (4+).',
    en: 'A player from your roster for one match only: their cost plus 30,000 (plus 50,000 for a primary skill). Has Loner (4+).',
  },
  star_player: {
    it: 'Una leggenda per questa partita, al massimo due. Non prende SPP, non può essere MVP e gli infortuni spariscono a fine partita.',
    en: 'A legend for this match, at most two. Earns no SPP, cannot be MVP and injuries vanish after the match.',
  },
};

// Cerca un termine ignorando maiuscole e l'eventuale parte tra parentesi ("Getting Even (4+)")
export function glossaryTip(term: string): Tip | null {
  const key = term.trim().toLowerCase();
  return GLOSSARY[key] ?? GLOSSARY[key.replace(/\s*\(.*\)\s*$/, '')] ?? GLOSSARY[key.replace(/^"|"$/g, '')] ?? null;
}

// In due parole, per chi non ricorda il nome inglese
export const INDUCEMENT_SHORT: Record<string, Tip> = {
  prayers: { it: 'preghiere', en: 'prayers' },
  part_time_assistant_coaches: { it: 'vice-allenatori', en: 'assistant coaches' },
  temp_agency_cheerleaders: { it: 'cheerleader', en: 'cheerleaders' },
  team_mascot: { it: 'mascotte', en: 'mascot' },
  weather_mage: { it: 'mago del meteo', en: 'weather control' },
  blitzers_best_kegs: { it: 'barili di birra', en: 'beer kegs' },
  bribes: { it: 'mazzette all\'arbitro', en: 'paying off the ref' },
  extra_team_training: { it: 're-roll extra', en: 'extra re-rolls' },
  mortuary_assistant: { it: 'aiuto necromante', en: 'necromancer\'s helper' },
  plague_doctor: { it: 'medico della peste', en: 'plague medic' },
  riotous_rookies: { it: 'Journeymen extra', en: 'extra Journeymen' },
  wandering_apothecary: { it: 'medico in più', en: 'extra medic' },
  halfling_master_chef: { it: 'cuoco halfling', en: 'halfling cook' },
  dodgy_league_rep: { it: 'arbitro di parte', en: 'biased ref' },
  josef_bugman: { it: 'allenatore nano', en: 'dwarf coach' },
  sports_wizard: { it: 'mago', en: 'wizard' },
  mercenary: { it: 'giocatore a noleggio', en: 'hired player' },
  star_player: { it: 'leggenda', en: 'legend' },
};
