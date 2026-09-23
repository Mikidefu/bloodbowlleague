// I rifiuti del server (LiveErrorCode) detti in italiano o in inglese, con la squadra giusta dove serve.

import type { LiveErrorCode } from './rules';

export type LiveProblem = { code?: string; message: string; params?: Record<string, string | number> };

type Texts = Record<LiveErrorCode, [string, string]>;

const TEXTS: Partial<Texts> = {
  not_started: ['La partita dal vivo non è ancora iniziata.', 'The live match has not started yet.'],
  match_ended: ['La partita è chiusa: non si può più segnare niente.', 'The match is closed: nothing more can be recorded.'],
  match_played: ['Il referto è già stato salvato: i numeri ufficiali sono quelli del referto.', 'The match report has already been saved: the official numbers are in the report.'],
  not_your_team: ['Puoi segnare solo per la tua squadra.', 'You can only record for your own team.'],
  admin_only: ['Questo lo può annullare solo l’admin.', 'Only the admin can undo this.'],
  kickoff_first: ['Prima si tira il kick-off: la partita comincia da lì.', 'Roll the kick-off first: that is where the match starts.'],
  between_drives: ['Il drive è finito: prima tira il kick-off del prossimo.', 'The drive is over: roll the next kick-off first.'],
  no_turn_yet: ['Nessun turno in corso: prima tocca “Inizia il turno”.', 'No turn in progress: tap “Start turn” first.'],
  not_your_turn: ['Non è il suo turno: ora tocca a {team}.', 'Not their turn: it is {team}’s turn now.'],
  no_turns_left: ['Gli 8 turni del tempo sono finiti: inizia il tempo successivo.', 'The 8 turns of this half are over: start the next half.'],
  half_over: ['Il tempo è finito: prima inizia il tempo successivo.', 'The half is over: start the next half first.'],
  half_not_over: ['I turni del tempo non sono ancora finiti.', 'The turns of this half are not over yet.'],
  not_active_team: ['I Team Re-roll si usano solo nel proprio turno (p. 33): ora è il turno di {team}.', 'Team Re-rolls can only be used in your own turn (p. 33): it is {team}’s turn.'],
  no_rerolls: ['Non ci sono più reroll di questo tipo.', 'No re-rolls of this kind left.'],
  no_bribes: ['Non ci sono più Bribe.', 'No Bribes left.'],
  kickoff_done: ['Il kick-off di questo drive è già stato tirato.', 'The kick-off for this drive has already been rolled.'],
  kicking_team_only: ['Il kick-off lo tira la squadra che calcia (p. 48).', 'The kicking team rolls the kick-off (p. 48).'],
  no_kicking_team: ['Manca la squadra che calcia: scegli chi calcia nei supplementari.', 'No kicking team: pick who kicks in extra time.'],
  extra_time_not_allowed: ['I supplementari si giocano solo nei playoff finiti in parità (p. 83).', 'Extra time is only played in tied play-off matches (p. 83).'],
  already_undone: ['È già stato annullato.', 'It has already been undone.'],
  cannot_undo: ['Questo evento non si può annullare.', 'This event cannot be undone.'],
  wrong_half: ['Il prossimo tempo è il {half}°.', 'The next half is half {half}.'],
};

export function problemText(problem: LiveProblem, language: 'it' | 'en', teamName: (id: string) => string): string {
  const pair = problem.code ? TEXTS[problem.code as LiveErrorCode] : undefined;
  if (!pair) return problem.message;
  const text = pair[language === 'it' ? 0 : 1];
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = problem.params?.[key];
    if (value === undefined) return '';
    return key === 'team' ? teamName(String(value)) : String(value);
  });
}
