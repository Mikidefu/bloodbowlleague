'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import { STAR_PLAYERS, canHireStar, playsForText, teamFavoured, type StarPlayer } from '@/lib/starPlayers';
import { getRoster } from '@/lib/rosters';
import { STAT_KEYS, statLabel } from '@/lib/characteristics';
import styles from './Stars.module.css';

type TeamOption = { id: string; name: string; roster: string | null; team_league: string | null; favoured_of: string | null };
type Source = 'all' | 'rulebook' | 'online';

// Catalogo degli Star Player (p. 148 e Star Players PDF): filtri per squadra, fonte e testo libero
export default function StarsPage() {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [teamId, setTeamId] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [teams, setTeams] = useState<TeamOption[]>([]);

  useEffect(() => {
    fetch('/api/teams').then(r => (r.ok ? r.json() : [])).then((data: TeamOption[]) => {
      setTeams(Array.isArray(data) ? [...data].sort((a, b) => a.name.localeCompare(b.name)) : []);
    }).catch(() => setTeams([]));
  }, []);

  const team = teams.find(tm => tm.id === teamId) ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STAR_PLAYERS.filter(s => {
      if (source !== 'all' && s.source !== source) return false;
      if (team) {
        const favouredOf = teamFavoured(getRoster(team.roster), team.team_league, team.favoured_of);
        if (!canHireStar(s.playsFor, { league: team.team_league, favouredOf })) return false;
      }
      if (!q) return true;
      return [s.name, ...s.skills, ...s.keywords, s.special.name].some(text => text.toLowerCase().includes(q));
    });
  }, [query, source, team]);

  return (
      <div className={styles.page}>
        <PageHeader kicker="BLOODBOWL LEAGUE" title={t.stars.title} subtitle={t.stars.subtitle} icon={<Star size={44} />} />
        <p className={`card ${styles.intro}`}>{t.stars.intro}</p>

        {/* STRISCIA SCURA: ricerca e filtri */}
        <section className={styles.toolbar}>
          <div className={styles.toolbarMicro} aria-hidden="true">
            <span><i className={styles.microSquares} />{`Star players // Inducements p. 148`}</span>
            <span className={styles.toolbarCount}>{t.stars.count.replace('{n}', String(visible.length))}</span>
          </div>
          <div className={styles.filters}>
            <label className={styles.searchField}>
              <Search size={20} aria-hidden="true" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.stars.search} aria-label={t.stars.search} />
            </label>
            <label className={styles.filter}>
              <span>{t.stars.team}</span>
              <select value={teamId} onChange={e => setTeamId(e.target.value)}>
                <option value="">{t.stars.anyTeam}</option>
                {teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}{tm.team_league ? ` · ${tm.team_league}` : ''}</option>)}
              </select>
            </label>
            <label className={styles.filter}>
              <span>{t.stars.source}</span>
              <select value={source} onChange={e => setSource(e.target.value as Source)}>
                <option value="all">{t.stars.allSources}</option>
                <option value="rulebook">{t.stars.rulebook}</option>
                <option value="online">{t.stars.online}</option>
              </select>
            </label>
          </div>
          {team && !team.team_league && <p className={styles.notice}>{t.stars.noLeague}</p>}
        </section>

        {visible.length ? (
            <div className={styles.grid}>
              {visible.map(s => <StarCard key={s.key} star={s} lang={language} />)}
            </div>
        ) : (
            <p className={styles.empty}>{t.stars.none}</p>
        )}
      </div>
  );
}

function StarCard({ star, lang }: { star: StarPlayer; lang: 'it' | 'en' }) {
  const { t } = useLanguage();
  const partner = star.pair ? STAR_PLAYERS.find(s => s.pair === star.pair && s.key !== star.key) : null;

  return (
      <article id={star.key} className={styles.card} aria-labelledby={`${star.key}-name`}>
        <header className={styles.cardHead}>
          <h2 id={`${star.key}-name`} className={styles.name}>{star.name}</h2>
          <span className={styles.cost}>{star.cost.toLocaleString()} <small>gp</small></span>
        </header>

        <dl className={styles.stats}>
          {STAT_KEYS.map(key => (
              <div key={key} className={styles.stat}>
                <dt>{statLabel(key)}</dt>
                <dd>{star[key]}</dd>
              </div>
          ))}
        </dl>

        <div className={styles.body}>
          {partner && (
              <p className={styles.pair}>
                {t.stars.pair.replace('{name}', partner.name).replace('{cost}', star.cost.toLocaleString())}
              </p>
          )}
          <div className={styles.block}>
            <h3 className={styles.label}>{t.stars.skills}</h3>
            <p>{star.skills.join(', ')}</p>
          </div>
          <div className={styles.block}>
            <h3 className={styles.label}>{t.stars.playsFor}</h3>
            <p>{playsForText(star.playsFor, lang)}</p>
          </div>
          <div className={styles.block}>
            <h3 className={styles.label}>{t.stars.special}</h3>
            <p>
              <strong className={styles.specialName}>{star.special.name}</strong>
              <span className={`tag tag-navy ${styles.freq}`}>{t.stars.frequency[star.special.frequency]}</span>
            </p>
            <p className={styles.specialText}>{star.special.text[lang]}</p>
          </div>
        </div>

        <footer className={styles.foot}>
          <span className={styles.keywords}>({star.keywords.join(', ')})</span>
          <span className={styles.source}>
            {star.source === 'rulebook' ? `${t.stars.rulebook} ${t.stars.page.replace('{page}', String(star.page))}` : t.stars.online}
          </span>
        </footer>
      </article>
  );
}
