// Quali eventi arrivati da altri dispositivi meritano un avviso sul telefono di una squadra, e con che tono.
// Funzione pura: la companion la chiama con gli eventi nuovi e mostra banner + vibrazione.
// Le mosse normali dell'avversario (turni, reroll) non si segnalano: sarebbe solo rumore.

import { describeEvent, type DescribeContext } from './describe';
import { kickoffHeadline } from './kickoff';
import type { KickoffResult, LiveEvent } from './types';

export type Notice = { id: string; text: string; tone: 'good' | 'bad' | 'neutral' };

export function noticesFor(events: LiveEvent[], myTeamId: string, ctx: DescribeContext): Notice[] {
  const it = ctx.language === 'it';
  const L = (a: string, b: string) => (it ? a : b);
  const notices: Notice[] = [];
  const add = (e: LiveEvent, text: string, tone: Notice['tone'] = 'neutral') => notices.push({ id: e.id, text, tone });

  for (const e of events) {
    const p = e.payload;
    const mine = e.team_id === myTeamId;
    switch (e.type) {
      case 'kickoff_rolled': {
        const k = p as unknown as KickoffResult;
        const won = Array.isArray(k.winners) && k.winners.includes(myTeamId);
        if (k.total === 7 && won) add(e, L('Brilliant Coaching! Hai vinto un Team Re-roll per questo drive', 'Brilliant Coaching! You won a Team Re-roll for this drive'), 'good');
        else if (k.total === 2) add(e, L('Get the Ref: hai un Bribe gratis da usare entro fine partita', 'Get the Ref: you get a free Bribe to use before the end of the game'), 'good');
        else if (k.total === 6 && won) add(e, L('Cheering Fans: un assist offensivo in più al primo Block del tuo prossimo turno', 'Cheering Fans: an extra Offensive Assist on the first Block of your next turn'), 'good');
        else add(e, `Kick-off: ${kickoffHeadline(k, id => ctx.teamName(id), ctx.language)}`, (k.total === 11 || k.total === 12) && won ? 'bad' : 'neutral');
        break;
      }
      case 'chef_rolled': {
        const stolen = Number(p.stolen) || 0;
        if (mine) add(e, L(`Il tuo Halfling Master Chef ruba ${stolen} Team Re-roll`, `Your Halfling Master Chef steals ${stolen} Team Re-rolls`), stolen ? 'good' : 'neutral');
        else if (stolen) add(e, L(`Lo Chef avversario ti ruba ${stolen} Team Re-roll per questo tempo`, `The opposing Chef steals ${stolen} of your Team Re-rolls for this half`), 'bad');
        break;
      }
      case 'half_started':
        add(e, p.half === 3
          ? L('Si va ai supplementari: i Team Re-roll non si ricaricano', 'Extra time: Team Re-rolls are not replenished')
          : L('Inizia il secondo tempo: i Team Re-roll sono di nuovo pieni', 'Second half: your Team Re-rolls are full again'));
        break;
      case 'touchdown':
        add(e, mine ? L(`Dal web: ${describeEvent(e, ctx)}`, `From the web: ${describeEvent(e, ctx)}`) : L(`Touchdown di ${ctx.teamName(e.team_id)}`, `Touchdown by ${ctx.teamName(e.team_id)}`), mine ? 'good' : 'neutral');
        break;
      case 'match_ended':
        add(e, L('L’admin ha chiuso la partita', 'The admin closed the match'));
        break;
      default:
        // Il web (admin) ha registrato o annullato qualcosa per questa squadra: meglio saperlo
        if (mine && e.source === 'admin') add(e, L(`Dal web: ${describeEvent(e, ctx)}`, `From the web: ${describeEvent(e, ctx)}`));
    }
  }
  return notices;
}
