// Catalogo degli Star Player (Rulebook 2025 pp. 148, 192-196, più lo Star Players PDF ufficiale
// di warhammer-community.com, che la lega ammette). Dati di gioco trascritti dalle carte; la regola
// speciale è riassunta con parole nostre, come nel resto del sito.
//
// "Plays For" (p. 192): una star gioca per le squadre della stessa League, oppure per chi ha la stessa
// special rule (es. Favoured of Nurgle), oppure per qualunque squadra (con eventuali esclusioni).
// Le coppie (es. Grak & Crumbleberry) si ingaggiano solo insieme: una sola scelta, un solo costo,
// due posti in squadra (p. 148).

import type { Characteristics } from '@/lib/characteristics';
import { favouredOptions, type Roster, type TeamLeague } from '@/lib/rosters';

export type PlaysFor = {
  any?: boolean;                 // qualunque squadra...
  except?: TeamLeague[];         // ...tranne queste League
  leagues?: TeamLeague[];
  favoured?: string[];           // Favoured of (Khorne, Nurgle, Hashut...)
};

// Quante volte si usa la regola speciale
export type Frequency = 'game' | 'half' | 'drive' | 'activation' | 'always';

export type StarPlayer = Characteristics & {
  key: string;
  name: string;
  cost: number;                  // per le coppie: il costo di entrambi
  skills: string[];
  playsFor: PlaysFor;
  keywords: string[];
  special: { name: string; frequency: Frequency; text: { it: string; en: string } };
  source: 'rulebook' | 'online';
  page?: number;                 // pagina del Rulebook
  pair?: string;                 // chiave della coppia
};

type Profile = [Characteristics['ma'], Characteristics['st'], Characteristics['ag'], Characteristics['pa'], Characteristics['av']];

const leagues = (...list: TeamLeague[]): PlaysFor => ({ leagues: list });
const favoured = (...gods: string[]): PlaysFor => ({ favoured: gods });
const anyTeam = (except: TeamLeague[] = []): PlaysFor => ({ any: true, except });
const either = (list: TeamLeague[], gods: string[]): PlaysFor => ({ leagues: list, favoured: gods });

function star(
    key: string, name: string, cost: number, [ma, st, ag, pa, av]: Profile, skills: string[], playsFor: PlaysFor,
    keywords: string[], specialName: string, frequency: Frequency, text: { it: string; en: string },
    extra: { pair?: string; page?: number } = {},
): StarPlayer {
  return {
    key, name, cost, ma, st, ag, pa, av, skills, playsFor, keywords,
    special: { name: specialName, frequency, text },
    source: extra.page ? 'rulebook' : 'online',
    ...extra,
  };
}

export const STAR_PLAYERS: StarPlayer[] = [
  // --- Rulebook, pp. 193-196 ---
  star('akhorne-the-squirrel', 'Akhorne the Squirrel', 80000, [7, 1, '2+', '-', '6+'],
    ['Claws', 'Dauntless', 'Dodge', 'Frenzy', 'Jump Up', 'Loner (4+)', 'No Ball', 'Sidestep', 'Stunty', 'Titchy'],
    anyTeam(), ['Blitzer', 'Squirrel'],
    'Blind Rage', 'always',
    { it: 'Può ripetere il D6 del tiro di Dauntless.',
      en: 'He may re-roll the D6 when rolling for Dauntless.' },
    { page: 193 }),
  star('anqi-panqi', 'Anqi Panqi', 190000, [7, 4, '5+', '6+', '10+'],
    ['Block', 'Grab', 'Loner (4+)', 'Stand Firm', 'Unsteady'],
    leagues('Lustrian Superleague'), ['Blocker', 'Lizardman'],
    'Savage Blow', 'game',
    { it: 'In un Block può ripetere quanti dadi blocco vuole.',
      en: 'In a Block he may re-roll any number of the Block Dice.' },
    { page: 193 }),
  star('cindy-piewhistle', 'Cindy Piewhistle', 100000, [5, 2, '3+', '3+', '7+'],
    ['Accurate', 'Bombardier', 'Dodge', 'Loner (4+)', 'Secret Weapon', 'Stunty'],
    leagues('Halfling Thimble Cup', 'Old World Classic'), ['Halfling', 'Special'],
    'All You Can Eat', 'game',
    { it: 'Può lanciare due bombe invece di una, se lo dichiara prima della prima; dopo la seconda tira un D6 e con 1-3 viene espulsa.',
      en: 'She may throw two bombs instead of one, if declared before the first; after the second she rolls a D6 and on a 1-3 is Sent-off.' },
    { page: 193 }),
  star('count-luthor-von-drakenborg', 'Count Luthor von Drakenborg', 300000, [6, 5, '2+', '3+', '10+'],
    ['Block', 'Hypnotic Gaze', 'Loner (4+)', 'Regeneration', 'Sidestep'],
    leagues('Sylvanian Spotlight'), ['Blocker', 'Vampire'],
    'Star of the Show', 'game',
    { it: 'Quando segna un Touchdown la sua squadra ottiene un Team Re-roll fino a fine del drive successivo.',
      en: 'When he scores a Touchdown his team gains a Team Re-roll until the end of the following drive.' },
    { page: 193 }),
  star('griff-oberwald', 'Griff Oberwald', 300000, [7, 4, '2+', '3+', '9+'],
    ['Block', 'Dodge', 'Fend', 'Loner (3+)', 'Sprint', 'Sure Feet'],
    leagues('Old World Classic'), ['Blitzer', 'Human'],
    'Consummate Professional', 'game',
    { it: '+1 a un test di Agility, anche dopo aver visto il risultato.',
      en: '+1 to an Agility test, even after seeing the result.' },
    { page: 194 }),
  star('grim-ironjaw', 'Grim Ironjaw', 190000, [5, 4, '3+', '6+', '9+'],
    ['Block', 'Dauntless', 'Frenzy', 'Hatred (Big Guy)', 'Loner (4+)', 'Multiple Block', 'Thick Skull'],
    leagues('Worlds Edge Superleague'), ['Dwarf', 'Special'],
    'Slayer', 'game',
    { it: 'Quando atterra un Big Guy con un Block, +1 al tiro armatura o infortunio, anche dopo aver visto il risultato.',
      en: 'When he Knocks Down a Big Guy with a Block, +1 to the Armour or Injury roll, even after seeing the result.' },
    { page: 194 }),
  star('jeremiah-kool', 'Jeremiah Kool', 300000, [8, 3, '1+', '2+', '9+'],
    ['Block', 'Dodge', 'Diving Catch', 'Dump-off', 'Loner (4+)', 'Nerves of Steel', 'On the Ball', 'Pass', 'Sidestep'],
    leagues('Elven Kingdoms League'), ['Elf', 'Runner'],
    'The Flashing Blade', 'game',
    { it: 'A inizio attivazione fa uno Stab contro un avversario che sta marcando e poi può ancora muoversi.',
      en: 'At the start of his activation he Stabs an opponent he is Marking, and may then still make a Move Action.' },
    { page: 194 }),
  star('josef-bugman', 'Josef Bugman', 180000, [5, 3, '3+', '4+', '9+'],
    ['Block', 'Drunkard', 'Fend', 'Loner (3+)', 'Tackle', 'Taunt', 'Thick Skull'],
    leagues('Old World Classic', 'Worlds Edge Superleague'), ['Blocker', 'Dwarf'],
    'Dwarfen Grit', 'game',
    { it: 'Quando la sua armatura si rompe puoi far ripetere il tiro armatura.',
      en: 'When his armour is broken you may have the Armour Roll re-rolled.' },
    { page: 194 }),
  star('lord-borak-the-despoiler', 'Lord Borak the Despoiler', 270000, [5, 5, '3+', '5+', '10+'],
    ['Block', 'Dirty Player', 'Leader', 'Loner (3+)', 'Mighty Blow', 'Put the Boot In', 'Sneaky Git'],
    leagues('Chaos Clash'), ['Blocker', 'Human'],
    'Lord of Chaos', 'game',
    { it: 'In un Block può ripetere un singolo dado blocco.',
      en: 'In a Block he may re-roll a single Block Dice.' },
    { page: 195 }),
  star('morg-n-thorg', 'Morg ’n’ Thorg', 340000, [6, 6, '3+', '4+', '11+'],
    ['Block', 'Bullseye', 'Hatred (Undead)', 'Loner (4+)', 'Mighty Blow', 'Thick Skull', 'Throw Team-mate'],
    anyTeam(['Sylvanian Spotlight']), ['Big Guy', 'Ogre'],
    'The Ballista', 'game',
    { it: 'In un Throw Team-mate può ripetere il test di Passing Ability.',
      en: 'In a Throw Team-mate he may re-roll the Passing Ability test.' },
    { page: 195 }),
  star('puggy-baconbreath', 'Puggy Baconbreath', 130000, [5, 3, '3+', '3+', '8+'],
    ['Block', 'Dodge', 'Loner (3+)', 'Nerves of Steel', 'Right Stuff', 'Stunty'],
    leagues('Halfling Thimble Cup', 'Old World Classic'), ['Blitzer', 'Halfling'],
    'Halfling Luck', 'game',
    { it: 'Può ripetere un singolo dado di qualunque tiro, tranne armatura, infortunio e Casualty.',
      en: 'He may re-roll a single dice of any roll, except Armour, Injury and Casualty rolls.' },
    { page: 195 }),
  star('ripper-bolgrot', 'Ripper Bôlgrot', 250000, [5, 6, '5+', '4+', '10+'],
    ['Bullseye', 'Grab', 'Loner (4+)', 'Mighty Blow', 'Regeneration', 'Throw Team-mate'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Big Guy', 'Troll'],
    'Thinking Man’s Troll', 'half',
    { it: 'Può ripetere un singolo dado di qualunque tiro, tranne armatura, infortunio e Casualty.',
      en: 'He may re-roll a single dice of any roll, except Armour, Injury and Casualty rolls.' },
    { page: 195 }),
  star('rodney-roachbait', 'Rodney Roachbait', 70000, [6, 2, '3+', '4+', '7+'],
    ['Catch', 'Diving Catch', 'Jump Up', 'Loner (4+)', 'On the Ball', 'Sidestep', 'Stunty', 'Wrestle'],
    leagues('Woodland League'), ['Gnome', 'Special'],
    'Catch of the Day', 'half',
    { it: 'Se è in piedi e inizia l’attivazione entro 3 caselle da una palla a terra tira un D6: con 3+ la prende subito.',
      en: 'If Standing and starting his activation within 3 squares of a ball on the ground, he rolls a D6: on a 3+ he takes it at once.' },
    { page: 196 }),
  star('rumbelow-sheepskin', 'Rumbelow Sheepskin', 170000, [6, 3, '3+', '5+', '8+'],
    ['Block', 'Horns', 'Juggernaut', 'Loner (4+)', 'Tackle', 'Thick Skull'],
    leagues('Halfling Thimble Cup'), ['Blitzer', 'Halfling'],
    'Ram', 'game',
    { it: 'Quando atterra un avversario con un Block, +1 al tiro armatura o infortunio, anche dopo aver visto il risultato.',
      en: 'When he Knocks Down an opponent with a Block, +1 to the Armour or Injury roll, even after seeing the result.' },
    { page: 196 }),
  star('skitter-stab-stab', 'Skitter Stab-Stab', 170000, [9, 2, '2+', '4+', '8+'],
    ['Dodge', 'Loner (4+)', 'Prehensile Tail', 'Shadowing', 'Stab'],
    leagues('Underworld Challenge'), ['Runner', 'Skaven'],
    'Master Assassin', 'game',
    { it: 'In uno Stab può ripetere il tiro armatura.',
      en: 'On a Stab he may re-roll the Armour Roll.' },
    { page: 196 }),
  star('varag-ghoul-chewer', 'Varag Ghoul-Chewer', 260000, [6, 5, '3+', '5+', '10+'],
    ['Block', 'Hatred (Undead)', 'Jump Up', 'Loner (4+)', 'Mighty Blow', 'Thick Skull', 'Unsteady'],
    leagues('Badlands Brawl'), ['Blocker', 'Orc'],
    'Krump and Smash', 'game',
    { it: 'Quando atterra un avversario con un Block può ripetere il tiro armatura.',
      en: 'When he Knocks Down an opponent with a Block he may re-roll the Armour Roll.' },
    { page: 196 }),
  // --- PDF online, pagine 1-4 ---
  star('barik-farblast', 'Barik Farblast', 80000, [6, 3, '4+', '3+', '9+'],
    ['Cannoneer', 'Hail Mary Pass', 'Loner (4+)', 'Pass', 'Secret Weapon', 'Sure Hands', 'Thick Skull'],
    leagues('Old World Classic', 'Worlds Edge Superleague'), ['Dwarf', 'Thrower'],
    'Blast It!', 'game',
    { it: 'Quando fa un Hail Mary Pass può ripetere i tiri di Scatter per il punto di caduta, e il compagno che prova a prendere la palla ha +1.',
      en: 'When he makes a Hail Mary Pass he may re-roll the Scatter results for where the ball lands, and a team-mate catching it gets +1.' }),
  star('bilerot-vomitflesh', 'Bilerot Vomitflesh', 180000, [4, 5, '4+', '6+', '10+'],
    ['Dirty Player', 'Disturbing Presence', 'Foul Appearance', 'Lone Fouler', 'Loner (4+)', 'Regeneration', 'Unsteady'],
    favoured('Nurgle'), ['Blocker', 'Human'],
    'Putrid Regurgitation', 'half',
    { it: 'Una volta per tempo può usare la Special Action Projectile Vomit, anche se nello stesso turno ha già fatto un Block.',
      en: 'Once per half he may use the Projectile Vomit Special Action, even if he already performed a Block Action this turn.' }),
  star('black-gobbo', 'The Black Gobbo', 210000, [6, 2, '3+', '3+', '8+'],
    ['Bombardier', 'Disturbing Presence', 'Dodge', 'Loner (3+)', 'Sidestep', 'Sneaky Git', 'Stab', 'Stunty'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Goblin', 'Special'],
    'Sneakiest of the Lot', 'always',
    { it: 'La sua squadra può dichiarare due Foul Action per turno invece di una, ma una delle due deve farla lui.',
      en: 'His team may declare two Foul Actions per turn instead of one, but one of them must be his.' }),
  star('boa-konssstriktr', 'Boa Kon’ssstriktr', 180000, [6, 3, '3+', '4+', '9+'],
    ['Dodge', 'Fend', 'Hypnotic Gaze', 'Loner (4+)', 'Prehensile Tail', 'Safe Pair of Hands', 'Sidestep'],
    leagues('Lustrian Superleague'), ['Runner', 'Snakeman'],
    'Look Into My Eyes', 'game',
    { it: 'Se inizia l’attivazione marcando l’avversario con la palla può tirare un D6: con 2+ gli ruba la palla e la sua attivazione finisce subito.',
      en: 'If he starts his activation Marking the opposing ball carrier he may roll a D6: on a 2+ he takes the ball and his activation ends at once.' }),
  star('bomber-dribblesnot', 'Bomber Dribblesnot', 80000, [6, 2, '3+', '3+', '8+'],
    ['Accurate', 'Bombardier', 'Dodge', 'Loner (4+)', 'Right Stuff', 'Secret Weapon', 'Stunty'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Goblin', 'Special'],
    'Kaboom!', 'game',
    { it: 'Se un avversario prende al volo una sua bomba, puoi farla esplodere subito invece di lasciargliela rilanciare.',
      en: 'If an opponent catches one of his bombs, you may have it explode at once instead of letting them throw it back.' }),
  star('captain-karina-von-riesz', 'Captain Karina von Riesz', 230000, [7, 4, '2+', '3+', '9+'],
    ['Bloodlust (2+)', 'Dodge', 'Hypnotic Gaze', 'Jump Up', 'Loner (4+)', 'Regeneration'],
    leagues('Sylvanian Spotlight'), ['Runner', 'Vampire'],
    'Tasty Morsel', 'game',
    { it: 'Quando fallisce il tiro di Bloodlust può mordere un avversario con ST 3 o meno come se fosse un Thrall Lineman della sua squadra (mai uno Star Player).',
      en: 'When she fails a Bloodlust roll she may bite an opponent with ST 3 or less as if they were a Thrall Lineman team-mate (never a Star Player).' }),
  star('deeproot-strongbranch', 'Deeproot Strongbranch', 280000, [2, 7, '5+', '4+', '11+'],
    ['Block', 'Bullseye', 'Loner (4+)', 'Mighty Blow', 'Stand Firm', 'Strong Arm', 'Thick Skull', 'Throw Team-mate', 'Timmm-ber!'],
    leagues('Woodland League'), ['Big Guy', 'Treeman'],
    'Reliable', 'always',
    { it: 'Se fa un Fumbled Throw con il Throw Team-mate, il compagno lanciato rimbalza come al solito ma atterra comunque in piedi.',
      en: 'If he Fumbles a Throw Team-mate, the thrown player Bounces as normal but always lands safely.' }),
  star('dribl', 'Dribl', 230000, [8, 2, '3+', '4+', '8+'],
    ['Dirty Player', 'Dodge', 'Loner (4+)', 'Quick Foul', 'Sidestep', 'Sneaky Git', 'Stunty'],
    leagues('Lustrian Superleague'), ['Skink', 'Special'],
    'A Sneaky Pair', 'always',
    { it: 'Si ingaggia solo insieme a Drull (230.000 per entrambi). Un Foul o uno Stab contro un avversario marcato da tutti e due ha +1.',
      en: 'Hired only together with Drull (230,000 for both). A Foul or Stab against an opponent Marked by both of them gets +1.' },
    { pair: 'dribl-drull' }),
  star('drull', 'Drull', 230000, [8, 2, '3+', '4+', '8+'],
    ['Dodge', 'Loner (4+)', 'Sidestep', 'Stab', 'Stunty'],
    leagues('Lustrian Superleague'), ['Skink', 'Special'],
    'A Sneaky Pair', 'always',
    { it: 'Si ingaggia solo insieme a Dribl (230.000 per entrambi). Un Foul o uno Stab contro un avversario marcato da tutti e due ha +1.',
      en: 'Hired only together with Dribl (230,000 for both). A Foul or Stab against an opponent Marked by both of them gets +1.' },
    { pair: 'dribl-drull' }),
  star('eldril-sidewinder', 'Eldril Sidewinder', 220000, [8, 3, '2+', '3+', '8+'],
    ['Catch', 'Dodge', 'Hypnotic Gaze', 'Loner (4+)', 'Nerves of Steel', 'On the Ball'],
    leagues('Elven Kingdoms League'), ['Catcher', 'Elf'],
    'Mesmerising Dance', 'half',
    { it: 'Una volta per tempo può ripetere il tiro della Special Action Hypnotic Gaze.',
      en: 'Once per half he may re-roll the dice for a Hypnotic Gaze Special Action.' }),
  star('estelle-la-veneaux', 'Estelle la Veneaux', 190000, [6, 3, '3+', '4+', '8+'],
    ['Disturbing Presence', 'Dodge', 'Guard', 'Loner (4+)', 'Sidestep'],
    leagues('Lustrian Superleague'), ['Human', 'Lineman'],
    'Baleful Hex', 'game',
    { it: 'A inizio attivazione sceglie un avversario entro 5 caselle e tira un D6: con 2+ diventa Distracted e non si può attivare nel prossimo turno della sua squadra.',
      en: 'At the start of her activation she picks an opponent within 5 squares and rolls a D6: on a 2+ they become Distracted and cannot be activated in their team’s next turn.' }),
  star('fungus-the-loon', 'Fungus the Loon', 80000, [4, 7, '3+', '-', '8+'],
    ['Ball & Chain', 'Loner (4+)', 'Mighty Blow', 'No Ball', 'Secret Weapon', 'Stunty'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Goblin', 'Special'],
    'Whirling Dervish', 'activation',
    { it: 'Una volta per attivazione può ripetere il D6 che decide la direzione in cui si muove.',
      en: 'Once per activation he may re-roll the D6 that decides which direction he moves in.' }),
  star('glart-smashrip', 'Glart Smashrip', 175000, [5, 4, '4+', '6+', '9+'],
    ['Block', 'Claws', 'Grab', 'Juggernaut', 'Loner (4+)', 'Stand Firm'],
    leagues('Underworld Challenge'), ['Blocker', 'Skaven'],
    'Frenzied Rush', 'half',
    { it: 'Quando dichiara un Blitz può prendere Frenzy fino a fine attivazione; in quel turno non può usare Grab.',
      en: 'When he declares a Blitz he may gain Frenzy until the end of his activation; he cannot use Grab that turn.' }),
  star('gloriel-summerbloom', 'Gloriel Summerbloom', 150000, [7, 2, '2+', '2+', '8+'],
    ['Accurate', 'Dodge', 'Loner (3+)', 'Pass', 'Sidestep', 'Sure Hands'],
    leagues('Elven Kingdoms League'), ['Elf', 'Thrower'],
    'Shot to Nothing', 'game',
    { it: 'Quando si attiva può prendere Hail Mary Pass fino a fine attivazione.',
      en: 'When activated she may gain Hail Mary Pass until the end of her activation.' }),
  // --- PDF online, pagine 5-8 ---
  star('glotl-stop', 'Glotl Stop', 260000, [6, 6, '5+', '6+', '10+'],
    ['Animal Savagery', 'Frenzy', 'Loner (4+)', 'Mighty Blow', 'Prehensile Tail', 'Stand Firm', 'Thick Skull'],
    leagues('Lustrian Superleague'), ['Big Guy', 'Lizardman'],
    'Primal Savagery', 'game',
    { it: 'Quando fallisce il tiro di Animal Savagery può sfogarsi su un avversario invece che su un compagno.',
      en: 'When he fails an Animal Savagery roll he may lash out at an opponent instead of a team-mate.' }),
  star('grak', 'Grak', 250000, [5, 5, '4+', '4+', '10+'],
    ['Bone Head', 'Kick Team-mate', 'Loner (4+)', 'Mighty Blow', 'Thick Skull'],
    anyTeam(), ['Big Guy', 'Ogre'],
    'I’ll Carry You', 'half',
    { it: 'Si ingaggia solo insieme a Crumbleberry (250.000 per entrambi). Se inizia l’attivazione accanto a lui può caricarselo addosso e posarlo accanto a sé a fine attivazione.',
      en: 'Hired only together with Crumbleberry (250,000 for both). If he starts his activation next to him he may pick him up and set him down next to himself at the end of the activation.' },
    { pair: 'grak-crumbleberry' }),
  star('crumbleberry', 'Crumbleberry', 250000, [5, 2, '3+', '5+', '7+'],
    ['Dodge', 'Lethal Flight', 'Loner (4+)', 'Right Stuff', 'Stunty', 'Sure Hands'],
    anyTeam(), ['Halfling', 'Lineman'],
    'I’ll Carry You', 'always',
    { it: 'Si ingaggia solo insieme a Grak (250.000 per entrambi). Mentre Grak lo porta, Grak ha Break Tackle e Dodge.',
      en: 'Hired only together with Grak (250,000 for both). While Grak carries him, Grak has Break Tackle and Dodge.' },
    { pair: 'grak-crumbleberry' }),
  star('grashnak-blackhoof', 'Grashnak Blackhoof', 240000, [6, 6, '4+', '6+', '9+'],
    ['Frenzy', 'Horns', 'Loner (4+)', 'Mighty Blow', 'Thick Skull', 'Unchannelled Fury'],
    leagues('Chaos Clash'), ['Big Guy', 'Minotaur'],
    'Gored by the Bull', 'game',
    { it: 'Nel Block di un Blitz tira un dado blocco in più, fino a tre; vale anche per il secondo Block dato da Frenzy.',
      en: 'In the Block of a Blitz he rolls one extra Block Dice, up to three; this also applies to the second Block from Frenzy.' }),
  star('gretchen-wachter', 'Gretchen Wächter', 180000, [7, 3, '2+', '-', '9+'],
    ['Disturbing Presence', 'Dodge', 'Foul Appearance', 'Jump Up', 'Loner (4+)', 'No Ball', 'Regeneration', 'Shadowing', 'Sidestep'],
    leagues('Sylvanian Spotlight'), ['Special', 'Undead', 'Wraith'],
    'Incorporeal', 'game',
    { it: 'Quando si attiva può usarla: fino a fine attivazione non deve tirare per uscire dalle Tackle Zone avversarie.',
      en: 'When activated she may use it: until the end of her activation she makes no Dodge rolls to leave opposing Tackle Zones.' }),
  star('grombrindal', 'Grombrindal', 170000, [5, 3, '3+', '4+', '10+'],
    ['Block', 'Break Tackle', 'Dauntless', 'Loner (4+)', 'Mighty Blow', 'Stand Firm', 'Sure Feet', 'Thick Skull'],
    leagues('Halfling Thimble Cup', 'Old World Classic', 'Worlds Edge Superleague'), ['Blocker', 'Dwarf'],
    'Wisdom of the White Dwarf', 'game',
    { it: 'Quando si attiva sceglie un compagno entro 2 caselle, che fino a fine turno ottiene una tra Break Tackle, Dauntless, Mighty Blow o Sure Feet.',
      en: 'When activated he picks a team-mate within 2 squares, who gains one of Break Tackle, Dauntless, Mighty Blow or Sure Feet until the end of the turn.' }),
  star('guffle-pusmaw', 'Guffle Pusmaw', 150000, [5, 4, '4+', '6+', '10+'],
    ['Foul Appearance', 'Loner (4+)', 'Monstrous Mouth', 'Nerves of Steel', 'On the Ball', 'Plague Ridden'],
    favoured('Nurgle'), ['Blocker', 'Human'],
    'Quick Bite', 'game',
    { it: 'Se marca un avversario che prende la palla, fa subito un tiro armatura contro di lui: se l’armatura si rompe, la palla passa a Guffle. Non causa Turnover.',
      en: 'If he Marks an opponent who catches the ball, he makes an Armour Roll against them at once: if it breaks, Guffle takes the ball. No Turnover.' }),
  star('hakflem-skuttlespike', 'Hakflem Skuttlespike', 200000, [8, 3, '2+', '3+', '8+'],
    ['Dodge', 'Extra Arms', 'Loner (4+)', 'Prehensile Tail', 'Two Heads'],
    leagues('Underworld Challenge'), ['Runner', 'Skaven'],
    'Treacherous', 'game',
    { it: 'Se all’attivazione è accanto a un compagno con la palla può prendergliela: il compagno viene atterrato, ma non è Turnover nemmeno se subisce una Casualty.',
      en: 'If he starts his activation next to a team-mate holding the ball he may take it: the team-mate is Knocked Down, with no Turnover even if they suffer a Casualty.' }),
  star('helmut-wulf', 'Helmut Wulf', 140000, [6, 3, '3+', '-', '9+'],
    ['Chainsaw', 'Loner (4+)', 'No Ball', 'Pro', 'Secret Weapon', 'Stand Firm'],
    leagues('Old World Classic'), ['Human', 'Special'],
    'Old Pro', 'game',
    { it: 'Può usare Pro per ripetere un singolo dado di un tiro armatura.',
      en: 'He may use Pro to re-roll a single dice of an Armour Roll.' }),
  star('htark-the-unstoppable', 'H’Thark the Unstoppable', 300000, [6, 6, '4+', '6+', '10+'],
    ['Block', 'Break Tackle', 'Defensive', 'Juggernaut', 'Loner (4+)', 'Sprint', 'Sure Feet', 'Thick Skull', 'Unsteady'],
    either(['Badlands Brawl'], ['Hashut']), ['Blitzer', 'Dwarf'],
    'Unstoppable Momentum', 'always',
    { it: 'Nel Block di un Blitz può ripetere un singolo dado blocco.',
      en: 'In the Block of a Blitz he may re-roll a single Block Dice.' }),
  star('ivan-deathshroud', 'Ivan ‘the Animal’ Deathshroud', 210000, [6, 4, '4+', '5+', '9+'],
    ['Block', 'Disturbing Presence', 'Hatred (Dwarf)', 'Juggernaut', 'Loner (4+)', 'Regeneration', 'Strip Ball', 'Tackle'],
    leagues('Sylvanian Spotlight'), ['Blitzer', 'Human', 'Skeleton', 'Undead'],
    'Dwarven Scourge', 'game',
    { it: 'Quando atterra un avversario con un Block, +1 al tiro armatura o infortunio; +2 se è un Dwarf.',
      en: 'When he Knocks Down an opponent with a Block, +1 to the Armour or Injury roll; +2 against a Dwarf.' }),
  star('ivar-eriksson', 'Ivar Eriksson', 215000, [6, 4, '3+', '4+', '9+'],
    ['Block', 'Guard', 'Loner (4+)', 'Tackle'],
    leagues('Old World Classic'), ['Blitzer', 'Human'],
    'Raiding Party', 'drive',
    { it: 'A inizio attivazione sceglie un compagno Open entro 5 caselle, che si sposta di una casella finendo a marcare un avversario.',
      en: 'At the start of his activation he picks an Open team-mate within 5 squares, who moves 1 square and must end up Marking an opponent.' }),
  star('jordell-freshbreeze', 'Jordell Freshbreeze', 280000, [8, 3, '1+', '3+', '8+'],
    ['Block', 'Diving Catch', 'Dodge', 'Leap', 'Loner (4+)', 'Sidestep', 'Steady Footing'],
    leagues('Elven Kingdoms League', 'Woodland League'), ['Blitzer', 'Elf'],
    'Swift as the Breeze', 'game',
    { it: 'Un tiro di Dodge, Leap o Rush riesce con 2+, qualunque siano i modificatori.',
      en: 'One Dodge, Leap or Rush test succeeds on a 2+, whatever the modifiers.' }),
  star('karla-von-kill', 'Karla von Kill', 210000, [6, 4, '3+', '3+', '9+'],
    ['Block', 'Dauntless', 'Dodge', 'Jump Up', 'Loner (4+)'],
    leagues('Lustrian Superleague', 'Old World Classic'), ['Blitzer', 'Human'],
    'Indomitable', 'game',
    { it: 'Quando riesce il tiro di Dauntless può portare la sua ST al doppio di quella del bersaglio.',
      en: 'When her Dauntless roll succeeds she may raise her ST to double the target’s.' }),
  star('kiroth-krakeneye', 'Kiroth Krakeneye', 160000, [7, 3, '2+', '3+', '8+'],
    ['Disturbing Presence', 'Foul Appearance', 'Loner (4+)', 'On the Ball', 'Tackle', 'Tentacles'],
    leagues('Elven Kingdoms League'), ['Elf', 'Runner'],
    'Black Ink', 'game',
    { it: 'A inizio attivazione sceglie un avversario che sta marcando: resta Distracted fino alla sua prossima attivazione.',
      en: 'At the start of an activation he picks an opponent he is Marking: they stay Distracted until they are next activated.' }),
  star('kreek-rustgouger', 'Kreek Rustgouger', 180000, [4, 7, '4+', '-', '10+'],
    ['Ball & Chain', 'Loner (4+)', 'Mighty Blow', 'No Ball', 'Prehensile Tail', 'Secret Weapon'],
    leagues('Underworld Challenge'), ['Big Guy', 'Skaven', 'Special'],
    'I’ll Be Back!', 'game',
    { it: 'La prima volta che verrebbe espulso per Secret Weapon resta in gioco; in quel caso non si può fare Argue the Call.',
      en: 'The first time he would be Sent-off for Secret Weapon he stays in the game; you cannot Argue the Call when this is used.' }),
  // --- PDF online, pagine 9-13 ---
  star('maple-highgrove', 'Maple Highgrove', 210000, [3, 5, '5+', '5+', '11+'],
    ['Brawler', 'Grab', 'Loner (4+)', 'Mighty Blow', 'Stand Firm', 'Tentacles', 'Thick Skull'],
    leagues('Woodland League'), ['Big Guy', 'Treeman'],
    'Vicious Vines', 'half',
    { it: 'Può fare un Block contro un avversario a 2 caselle di distanza, con le normali regole ma senza follow-up.',
      en: 'He may Block an opponent 2 squares away, with the normal rules but no follow-up.' }),
  star('max-spleenripper', 'Max Spleenripper', 130000, [5, 4, '4+', '-', '9+'],
    ['Chainsaw', 'Loner (4+)', 'No Ball', 'Secret Weapon'],
    favoured('Khorne'), ['Human', 'Special'],
    'Maximum Carnage', 'game',
    { it: 'Dopo un Chainsaw Attack può farne subito un altro contro un avversario diverso.',
      en: 'After a Chainsaw Attack he may immediately make another against a different opponent.' }),
  star('the-mighty-zug', 'The Mighty Zug', 220000, [5, 5, '4+', '6+', '10+'],
    ['Block', 'Loner (4+)', 'Mighty Blow', 'Unsteady'],
    leagues('Old World Classic', 'Worlds Edge Superleague'), ['Blocker', 'Human'],
    'Crushing Blow', 'game',
    { it: 'Quando atterra un avversario con un Block, +1 al tiro armatura, anche dopo aver visto il risultato.',
      en: 'When he Knocks Down an opponent with a Block, +1 to the Armour Roll, even after seeing the result.' }),
  star('nobbla-blackwart', 'Nobbla Blackwart', 120000, [6, 2, '3+', '-', '8+'],
    ['Block', 'Chainsaw', 'Dodge', 'Loner (4+)', 'No Ball', 'Saboteur', 'Secret Weapon', 'Stunty'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Goblin', 'Special'],
    'Kick ’em While They’re Down!', 'game',
    { it: 'Può fare un Chainsaw Attack contro un avversario Prone o Stunned; non è un Foul, quindi non può essere espulso.',
      en: 'He may make a Chainsaw Attack against a Prone or Stunned opponent; it is not a Foul, so he cannot be Sent-off for it.' }),
  star('rashnak-backstabber', 'Rashnak Backstabber', 130000, [7, 3, '3+', '5+', '8+'],
    ['Loner (4+)', 'Shadowing', 'Sidestep', 'Sneaky Git', 'Stab'],
    leagues('Badlands Brawl'), ['Goblin', 'Special'],
    'Toxin Connoisseur', 'game',
    { it: 'Quando rompe un’armatura con uno Stab, +1 al tiro infortunio, anche dopo aver visto il risultato.',
      en: 'When he breaks armour with a Stab, +1 to the Injury Roll, even after seeing the result.' }),
  star('rowana-forestfoot', 'Rowana Forestfoot', 160000, [6, 3, '3+', '4+', '8+'],
    ['Dodge', 'Dump-off', 'Guard', 'Horns', 'Jump Up', 'Leap', 'Loner (4+)'],
    leagues('Woodland League'), ['Blocker', 'Gnome'],
    'Bounding Leap', 'game',
    { it: 'Dichiarato un Leap, prima di tirare: nessun modificatore negativo al test di Agility, e può ripeterlo.',
      en: 'Having declared a Leap, before rolling: no negative modifiers to the Agility test, and she may re-roll it.' }),
  star('roxanna-darknail', 'Roxanna Darknail', 270000, [8, 3, '1+', '3+', '8+'],
    ['Dodge', 'Frenzy', 'Jump Up', 'Juggernaut', 'Leap', 'Loner (4+)'],
    leagues('Elven Kingdoms League'), ['Elf', 'Special'],
    'Slashing Nails', 'half',
    { it: 'Quando dichiara un Blitz ottiene Claws fino a fine attivazione.',
      en: 'When she declares a Blitz she gains Claws until the end of her activation.' }),
  star('scrappa-sorehead', 'Scrappa Sorehead', 120000, [7, 2, '3+', '4+', '8+'],
    ['Dirty Player', 'Dodge', 'Loner (4+)', 'Pogo', 'Right Stuff', 'Sprint', 'Stunty', 'Sure Feet'],
    leagues('Badlands Brawl', 'Underworld Challenge'), ['Goblin', 'Special'],
    'Yoink!', 'game',
    { it: 'Quando tenta un intercetto tira un D6: con 2+ intercetta automaticamente e prende la palla.',
      en: 'When he attempts an Interception he rolls a D6: on a 2+ he intercepts automatically and takes the ball.' }),
  star('scyla-anfingrimm', 'Scyla Anfingrimm', 200000, [5, 5, '4+', '6+', '10+'],
    ['Claws', 'Frenzy', 'Loner (4+)', 'Mighty Blow', 'Prehensile Tail', 'Thick Skull', 'Unchannelled Fury'],
    favoured('Khorne'), ['Big Guy', 'Spawn'],
    'Fury of the Blood God', 'game',
    { it: 'Se fa 1 su Unchannelled Fury dopo aver dichiarato un Block, invece dell’effetto normale fa due Block, uno dopo l’altro.',
      en: 'If he rolls a 1 for Unchannelled Fury after declaring a Block, instead of the usual effect he makes two Blocks, one after the other.' }),
  star('skrorg-snowpelt', 'Skrorg Snowpelt', 240000, [5, 5, '4+', '6+', '9+'],
    ['Block', 'Claws', 'Disturbing Presence', 'Juggernaut', 'Loner (4+)', 'Mighty Blow'],
    leagues('Old World Classic', 'Worlds Edge Superleague'), ['Big Guy', 'Yhetee'],
    'Pump Up the Crowd', 'game',
    { it: 'Quando toglie dal campo un avversario come Casualty con un Block, la sua squadra ottiene un Team Re-roll fino a fine drive.',
      en: 'When he removes an opponent as a Casualty with a Block, his team gains a Team Re-roll until the end of the drive.' }),
  star('skrull-halfheight', 'Skrull Halfheight', 150000, [6, 3, '4+', '3+', '9+'],
    ['Accurate', 'Loner (4+)', 'Nerves of Steel', 'Pass', 'Regeneration', 'Sure Hands', 'Thick Skull'],
    leagues('Sylvanian Spotlight', 'Worlds Edge Superleague'), ['Dwarf', 'Skeleton', 'Thrower', 'Undead'],
    'Strong Passing Game', 'game',
    { it: 'In un passaggio può aggiungere la sua ST al risultato del test di Passing Ability, fino a un massimo di 6.',
      en: 'On a Pass he may add his ST to the result of the Passing Ability test, up to a maximum of 6.' }),
  star('lucien-swift', 'Lucien Swift', 300000, [7, 3, '2+', '3+', '9+'],
    ['Block', 'Loner (4+)', 'Mighty Blow', 'Tackle'],
    leagues('Elven Kingdoms League'), ['Blitzer', 'Elf'],
    'Working in Tandem', 'always',
    { it: 'I gemelli Swift si ingaggiano solo insieme (300.000 per entrambi). Nel Block contro un avversario marcato anche da Valen, Lucien può ripetere un dado blocco.',
      en: 'The Swift Twins are hired only together (300,000 for both). Blocking an opponent also Marked by Valen, Lucien may re-roll a single Block Dice.' },
    { pair: 'swift-twins' }),
  star('valen-swift', 'Valen Swift', 300000, [7, 3, '2+', '2+', '9+'],
    ['Accurate', 'Loner (4+)', 'Nerves of Steel', 'Pass', 'Safe Pass', 'Sure Hands'],
    leagues('Elven Kingdoms League'), ['Elf', 'Thrower'],
    'Working in Tandem', 'always',
    { it: 'I gemelli Swift si ingaggiano solo insieme (300.000 per entrambi). Passando a Lucien, Valen ignora i modificatori di gittata.',
      en: 'The Swift Twins are hired only together (300,000 for both). Passing to Lucien, Valen ignores the range modifiers.' },
    { pair: 'swift-twins' }),
  star('swiftvine-glimmershard', 'Swiftvine Glimmershard', 110000, [7, 2, '3+', '5+', '7+'],
    ['Disturbing Presence', 'Fend', 'Loner (4+)', 'Sidestep', 'Stab', 'Stunty'],
    leagues('Woodland League'), ['Special', 'Spite'],
    'Furious Outburst', 'half',
    { it: 'Se è in piedi a inizio attivazione si sposta accanto a un avversario in piedi entro 3 caselle, lo attacca con uno Stab e poi si riposiziona entro 3 caselle; la sua attivazione finisce e vale come Blitz del turno.',
      en: 'If Standing at the start of her activation she moves next to a Standing opponent within 3 squares, Stabs them, then repositions within 3 squares; her activation ends and it counts as the team’s Blitz.' }),
  star('thorsson-stoutmead', 'Thorsson Stoutmead', 170000, [6, 3, '4+', '3+', '8+'],
    ['Block', 'Drunkard', 'Loner (4+)', 'Thick Skull'],
    leagues('Old World Classic', 'Worlds Edge Superleague'), ['Human', 'Lineman'],
    'Beer Barrel Bash', 'drive',
    { it: 'A inizio attivazione sceglie un avversario entro 3 caselle e tira un D6: con 3+ lo atterra, con 2 niente, con 1 cade lui. Poi la sua attivazione finisce.',
      en: 'At the start of his activation he picks an opponent within 3 squares and rolls a D6: on a 3+ they are Knocked Down, on a 2 nothing, on a 1 he Falls Over. His activation then ends.' }),
  star('wilhelm-chaney', 'Wilhelm Chaney', 220000, [8, 4, '3+', '4+', '9+'],
    ['Catch', 'Claws', 'Frenzy', 'Loner (4+)', 'Regeneration', 'Wrestle'],
    leagues('Sylvanian Spotlight'), ['Blitzer', 'Undead', 'Werewolf'],
    'Savage Mauling', 'game',
    { it: 'Può ripetere un tiro infortunio fatto contro un avversario.',
      en: 'He may re-roll an Injury Roll he makes against an opponent.' }),
  star('willow-rosebark', 'Willow Rosebark', 160000, [6, 4, '3+', '5+', '9+'],
    ['Dauntless', 'Loner (4+)', 'Sidestep', 'Thick Skull'],
    leagues('Woodland League'), ['Blitzer', 'Dryad'],
    'Woodland Fury', 'game',
    { it: 'Se un suo Block la farebbe cadere, può ripetere un singolo dado blocco.',
      en: 'If one of her Blocks would Knock her Down, she may re-roll a single Block Dice.' }),
  star('withergrasp-doubledrool', 'Withergrasp Doubledrool', 170000, [6, 3, '3+', '4+', '9+'],
    ['Foul Appearance', 'Loner (4+)', 'Prehensile Tail', 'Tackle', 'Tentacles', 'Two Heads', 'Wrestle'],
    favoured('Nurgle'), ['Beastman', 'Blocker'],
    'Watch Out!', 'drive',
    { it: 'La prima volta in ogni drive che un avversario lo blocca, conta come se avesse Dodge.',
      en: 'The first time in each drive an opponent Blocks him, he counts as having Dodge.' }),
  star('zzharg-madeye', 'Zzharg Madeye', 130000, [4, 4, '4+', '3+', '10+'],
    ['Cannoneer', 'Hail Mary Pass', 'Loner (4+)', 'Nerves of Steel', 'Secret Weapon', 'Thick Skull'],
    favoured('Hashut'), ['Dwarf', 'Special'],
    '“Blastin’ Solves Everything”', 'half',
    { it: 'A inizio attivazione mira a un avversario in piedi entro 3 caselle e tira un D6: con 3+ lo colpisce; con 2 l’avversario sceglie un altro giocatore vicino da colpire; con 1 colpisce sé stesso. Tiro armatura sul colpito, poi l’attivazione finisce.',
      en: 'At the start of his activation he targets a Standing opponent within 3 squares and rolls a D6: on a 3+ it is hit; on a 2 the opposing coach picks another nearby player to be hit; on a 1 he hits himself. Armour Roll on whoever is hit, then his activation ends.' }),
  star('zolcath-the-zoat', 'Zolcath the Zoat', 220000, [5, 5, '4+', '5+', '10+'],
    ['Disturbing Presence', 'Juggernaut', 'Loner (4+)', 'Mighty Blow', 'Prehensile Tail', 'Regeneration', 'Sure Feet'],
    leagues('Elven Kingdoms League', 'Lustrian Superleague'), ['Big Guy', 'Zoat'],
    '“Excuse Me, Are You a Zoat?”', 'game',
    { it: 'Quando si attiva sceglie un avversario entro 3 caselle, che diventa subito Distracted.',
      en: 'When activated he picks an opponent within 3 squares, who becomes Distracted at once.' }),
].sort((a, b) => a.name.localeCompare(b.name));

export const getStarPlayer = (key: string | null | undefined) => STAR_PLAYERS.find(s => s.key === key) ?? null;

// ------------------------------------------------------------------
// Ingaggio: una star da sola, oppure una coppia
// ------------------------------------------------------------------

export type StarHire = {
  key: string;                   // chiave della star, o della coppia
  name: string;
  cost: number;
  members: StarPlayer[];         // 1, o 2 per le coppie
  playsFor: PlaysFor;
};

const PAIR_NAMES: Record<string, string> = {
  'dribl-drull': 'Dribl & Drull',
  'grak-crumbleberry': 'Grak & Crumbleberry',
  'swift-twins': 'The Swift Twins',
};

export const STAR_HIRES: StarHire[] = (() => {
  const hires: StarHire[] = [];
  const seenPairs = new Set<string>();
  for (const s of STAR_PLAYERS) {
    if (!s.pair) {
      hires.push({ key: s.key, name: s.name, cost: s.cost, members: [s], playsFor: s.playsFor });
    } else if (!seenPairs.has(s.pair)) {
      seenPairs.add(s.pair);
      const members = STAR_PLAYERS.filter(m => m.pair === s.pair);
      hires.push({ key: s.pair, name: PAIR_NAMES[s.pair] ?? members.map(m => m.name).join(' & '), cost: s.cost, members, playsFor: s.playsFor });
    }
  }
  return hires.sort((a, b) => a.name.localeCompare(b.name));
})();

export const getStarHire = (key: string | null | undefined) => STAR_HIRES.find(h => h.key === key) ?? null;

// La squadra può ingaggiarla? league = League scelta al draft, favouredOf = allineamento della squadra
export function canHireStar(playsFor: PlaysFor, team: { league: string | null; favouredOf: string | null }) {
  if (playsFor.any && !(team.league && playsFor.except?.includes(team.league as TeamLeague))) return true;
  if (team.league && playsFor.leagues?.includes(team.league as TeamLeague)) return true;
  if (team.favouredOf && playsFor.favoured?.includes(team.favouredOf)) return true;
  return false;
}

// Allineamento della squadra per il "Plays For": quello scelto al draft, oppure l'unico possibile
export function teamFavoured(roster: Roster | null, league: string | null, favouredOf: string | null) {
  if (favouredOf) return favouredOf;
  const options = favouredOptions(roster, league);
  return options.length === 1 ? options[0] : null;
}

// "Old World Classic o Worlds Edge Superleague", "Favoured of Nurgle", "Qualunque squadra tranne..."
export function playsForText(playsFor: PlaysFor, lang: 'it' | 'en') {
  const or = lang === 'it' ? ' o ' : ' or ';
  if (playsFor.any) {
    const base = lang === 'it' ? 'Qualunque squadra' : 'Any team';
    return playsFor.except?.length ? `${base} ${lang === 'it' ? 'tranne' : 'except'} ${playsFor.except.join(', ')}` : base;
  }
  return [...(playsFor.leagues ?? []), ...(playsFor.favoured ?? []).map(g => `Favoured of ${g}`)].join(or);
}
