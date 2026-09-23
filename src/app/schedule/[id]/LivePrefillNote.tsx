'use client';
// Sopra il referto: cosa è arrivato dalla partita dal vivo, cosa va controllato a mano, e il tasto per rimetterlo.

import { Radio, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { LivePrefill, ReportStatField } from '@/lib/live/prefill';
import type { MatchDetails } from '@/lib/types';
import wz from '@/components/match/Wizard.module.css';

const LABEL: Record<ReportStatField, string> = { td: 'TD', cas: 'CAS', int: 'INT', comp: 'CMP', ttm: 'TTM', landing: 'ATT' };
const line = (stats: Partial<Record<ReportStatField, number>>) =>
  (Object.entries(stats) as [ReportStatField, number][]).filter(([, n]) => n).map(([k, n]) => `${n} ${LABEL[k]}`).join(', ');

export default function LivePrefillNote({ match, prefill, applied, onApply }: { match: MatchDetails; prefill: LivePrefill; applied: boolean; onApply: () => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const name = (teamId: string) => (teamId === match.home_team_id ? match.home_name : match.away_name);
  const playerName = (id: string) => [...match.homePlayers, ...match.awayPlayers].find(p => p.id === id)?.name ?? id;
  const h = prefill.scores[match.home_team_id] ?? 0;
  const a = prefill.scores[match.away_team_id] ?? 0;
  const loose = Object.entries(prefill.withoutPlayer);

  return (
      <div className={wz.note} style={{ marginBottom: '1rem', display: 'grid', gap: '0.5rem' }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Radio size={18} aria-hidden="true" />
          {applied
            ? L('Referto precompilato dalla partita dal vivo', 'Report prefilled from the live match')
            : L('La partita dal vivo ha dei numeri per questo referto', 'The live match has numbers for this report')}
        </strong>
        <span>
          {name(match.home_team_id)} {h} – {a} {name(match.away_team_id)} · {L(`${prefill.events} statistiche`, `${prefill.events} stats`)} ·
          CAS {prefill.casualties[match.home_team_id] ?? 0}–{prefill.casualties[match.away_team_id] ?? 0}
        </span>
        <span>{L('Controlla ogni passo prima di confermare: infortuni e MVP li scegli tu, come sempre.', 'Check every step before confirming: injuries and MVPs are yours to pick, as always.')}</span>
        {loose.map(([teamId, stats]) => (
            <span key={teamId} className={wz.warn}>
              {L(`${name(teamId)}: ${line(stats)} senza giocatore. Contano nel totale della squadra ma non danno SPP: va bene se è stato il pubblico, uno Star Player o un Mercenario; altrimenti assegnale a un giocatore nel passo Statistiche.`,
                  `${name(teamId)}: ${line(stats)} without a player. They count in the team total but earn no SPP: fine if it was the crowd, a Star Player or a Mercenary; otherwise assign them to a player in the Stats step.`)}
            </span>
        ))}
        {prefill.skipped.map(s => (
            <span key={s.player_id} className={wz.warn}>
              {L(`${playerName(s.player_id)} (${name(s.team_id)}) ha ${line(s.stats)} nel live ma non poteva giocare questa partita: non sono stati riportati.`,
                  `${playerName(s.player_id)} (${name(s.team_id)}) has ${line(s.stats)} in the live match but could not play this match: they were not carried over.`)}
            </span>
        ))}
        <div className={wz.actions}>
          <button type="button" className="btn" onClick={() => {
            if (confirm(L('Usare i numeri del live? Punteggio e statistiche scritti nel referto vengono sostituiti (infortuni e MVP restano).', 'Use the live numbers? The score and stats in the report are replaced (injuries and MVPs stay).'))) onApply();
          }}>
            <RotateCcw size={16} /> {applied ? L('Rimetti i numeri del live', 'Put the live numbers back') : L('Usa i numeri del live', 'Use the live numbers')}
          </button>
        </div>
      </div>
  );
}
