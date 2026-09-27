'use client';
// I Prayers to Nuffle tirati da una squadra (pp. 142-143): cosa fanno e a chi, con il profilo di partita
// dei giocatori scelti (AV, MA, skill in più). Valgono solo per questa partita: la rosa non cambia.

import { useLanguage } from '@/lib/i18n/LanguageContext';
import { improveCharacteristic, reduceCharacteristic, type ArmourValue, type MovementValue } from '@/lib/characteristics';
import { getMatchTable } from '@/lib/matchTables';
import { getPrayer, type PrayerResult } from '@/lib/prayers';
import type { MatchDetails } from '@/lib/types';
import wz from './Wizard.module.css';

export type PrayerPlayer = { name: string; ma: MovementValue; av: ArmourValue };

// Giocatori della partita per id, con il numero di maglia davanti al nome
export function matchPrayerPlayer(match: MatchDetails) {
  const players = new Map([...match.homePlayers, ...match.awayPlayers].map(p => [p.id, p]));
  return (id: string): PrayerPlayer | null => {
    const p = players.get(id);
    return p ? { name: `${p.jersey_number ? `#${p.jersey_number} ` : ''}${p.name}`, ma: p.ma, av: p.av } : null;
  };
}

// Cosa cambia per il giocatore scelto, in una riga
export function prayerEffectText(prayer: PrayerResult, player: PrayerPlayer | null) {
  const def = getPrayer(prayer.roll);
  if (!def) return '';
  if (def.av && player) return `AV ${player.av} → ${improveCharacteristic('av', player.av) ?? player.av}`;
  if (def.ma && player) return `MA ${player.ma} → ${reduceCharacteristic('ma', player.ma) ?? player.ma}`;
  const skill = def.primarySkill ? prayer.skill : def.skill;
  return skill ? `+ ${skill}` : '';
}

export default function PrayerList({ prayers, player }: { prayers: PrayerResult[]; player: (id: string) => PrayerPlayer | null }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const rows = getMatchTable('prayers')!.rows;
  if (!prayers.length) return null;

  return (
      <ul className={wz.list} aria-label="Prayers to Nuffle">
        {prayers.map(p => {
          const def = getPrayer(p.roll);
          const row = rows.find(r => r.min === p.roll);
          if (!def || !row) return null;
          return (
              <li key={p.roll} className={`${wz.outcome} ${row.tone === 'good' ? wz.outcomeGood : ''}`}>
                <span className={wz.outcomeName}>{p.roll} · {def.name}</span>
                <p>{row.text[language]}</p>
                {(p.players ?? []).length > 0 && (
                    <p>
                      {(p.players ?? []).map(id => {
                        const pl = player(id);
                        const effect = prayerEffectText(p, pl);
                        return <span key={id} style={{ display: 'block' }}><b>{pl?.name ?? L('giocatore non più in rosa', 'player no longer on the roster')}</b>{effect ? `: ${effect}` : ''}</span>;
                      })}
                    </p>
                )}
                {def.oncePerGame && <p>{L('Una volta per partita: ricordatevi quando la usate.', 'Once per game: keep track of when you use it.')}</p>}
              </li>
          );
        })}
      </ul>
  );
}
