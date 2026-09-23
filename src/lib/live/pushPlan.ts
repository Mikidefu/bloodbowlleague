// Quali notifiche push partono verso quali telefoni, dopo nuovi eventi. Funzione pura, senza rete né DB:
// riusa noticesFor, così con l'app chiusa arrivano gli stessi avvisi che si vedono con l'app aperta.

import { noticesFor } from './notify';
import type { KickoffResult, LiveEvent } from './types';

export type PushTarget = { endpoint: string; team_id: string; language: 'it' | 'en' };
export type PushMessage = { title: string; body: string; tag: string; url: string; tone: 'good' | 'bad' | 'neutral' };
export type PushNames = { teams: Record<string, string>; players: Record<string, string> };

export const MAX_PUSHES_PER_BATCH = 3;   // oltre, un solo riepilogo: un lotto dalla coda offline non deve fare 20 notifiche

// L'evento l'ha fatto questa squadra dal suo telefono: non serve avvisarla
function ownedBy(event: LiveEvent, teamId: string, owned: Set<string>) {
  if (event.team_id === teamId && event.source === 'companion') return true;
  if (event.type === 'kickoff_rolled' && event.team_id === teamId && (event.payload as unknown as KickoffResult & { requested_by?: string }).requested_by === 'companion') return true;
  const cause = event.payload.cause;
  return typeof cause === 'string' && owned.has(cause);
}

export function planPushes(matchId: string, newEvents: LiveEvent[], allEvents: LiveEvent[], targets: PushTarget[], names: PushNames) {
  const out: { target: PushTarget; message: PushMessage }[] = [];
  for (const target of targets) {
    const owned = new Set(newEvents.filter(e => e.team_id === target.team_id && e.source === 'companion').map(e => e.id));
    const others = newEvents.filter(e => !ownedBy(e, target.team_id, owned));
    const it = target.language === 'it';
    const notices = noticesFor(others, target.team_id, {
      language: target.language,
      teamName: id => (id ? names.teams[id] ?? '—' : '—'),
      playerName: id => names.players[id] ?? null,
      events: allEvents,
    });
    if (!notices.length) continue;
    const title = `Blood Bowl · ${names.teams[target.team_id] ?? 'Companion'}`;
    const url = `/companion/${matchId}`;
    if (notices.length > MAX_PUSHES_PER_BATCH) {
      const tone = notices.some(n => n.tone === 'good') ? 'good' : notices.some(n => n.tone === 'bad') ? 'bad' : 'neutral';
      const body = `${it ? `${notices.length} novità` : `${notices.length} updates`}: ${notices.slice(-2).map(n => n.text).join(' · ')}`;
      out.push({ target, message: { title, body, tag: `batch-${notices[notices.length - 1].id}`, url, tone } });
      continue;
    }
    for (const n of notices) out.push({ target, message: { title, body: n.text, tag: n.id, url, tone: n.tone } });
  }
  return out;
}
