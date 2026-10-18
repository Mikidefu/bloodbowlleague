'use client';
// Le rose delle due squadre sul telefono (la propria e, in una seconda linguetta, quella avversaria):
// un pannello che scorre sopra il tabellone (la partita dal vivo continua sotto, avvisi compresi). Due livelli, perché a 360 px non ci sta tutto insieme:
// l'elenco con profilo e skill di ognuno, e la scheda del giocatore con il testo delle skill.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ADVANCEMENT_TIERS, MAX_ADVANCEMENTS, categoryLetters, categoryName } from '@/lib/advancement';
import { STAT_KEYS, statLabel } from '@/lib/characteristics';
import { parseInducements, rosterEntries, skillLabel, starEntries, type RosterEntry } from '@/lib/live/roster';
import { hatredList, mustAdvance } from '@/lib/players';
import { prayerEffects, type PrayerResult } from '@/lib/prayers';
import { skillBaseName } from '@/lib/rosters';
import { playsForText } from '@/lib/starPlayers';
import type { MatchDetails, Skill, TeamWithPlayers } from '@/lib/types';
import styles from './Roster.module.css';

const LIST = 'list';
const OPP = 'opp';
const HASH = '#roster';

// Cosa si sta guardando: null = tabellone, 'list' = la mia rosa, 'opp' = quella avversaria, altrimenti l'id del giocatore.
// Sta nell'hash dell'URL, così il tasto Indietro del telefono torna all'elenco e poi al tabellone.
export function useRosterView() {
  const [view, setView] = useState<string | null>(null);

  useEffect(() => {
    const read = () => (window.location.hash.startsWith(HASH) ? decodeURIComponent(window.location.hash.slice(HASH.length + 1)) || LIST : null);
    // Pagina ricaricata con la rosa aperta: si riparte dal tabellone, senza voci di cronologia a cui tornare
    if (read()) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const onPop = () => setView(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: string, replace = false) => {
    const url = next === LIST ? HASH : `${HASH}=${encodeURIComponent(next)}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setView(next);
  }, []);

  return {
    view,
    openList: useCallback(() => go(LIST), [go]),
    openPlayer: useCallback((id: string) => go(id), [go]),
    // Giocatore precedente/successivo o cambio di squadra: non aggiunge un passo, Indietro torna dove tornava prima
    swap: useCallback((next: string) => go(next, true), [go]),
    back: useCallback(() => window.history.back(), []),
  };
}

type Props = {
  view: string | null;
  teams: RosterTeam[];                       // la mia squadra, poi l'avversaria
  match: MatchDetails | null;
  prayers: Record<string, PrayerResult[]>;   // Prayers to Nuffle delle due squadre, per id squadra
  onOpenPlayer: (id: string) => void;
  onSwap: (view: string) => void;
  onBack: () => void;
};

export type RosterTeam = { id: string; name: string; color: string | null };

export default function RosterSlide({ view, teams, match, prayers, onOpenPlayer, onSwap, onBack }: Props) {
  const { language, t } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [loaded, setLoaded] = useState<Record<string, TeamWithPlayers>>({});
  const [allSkills, setAllSkills] = useState<Skill[] | null>(null);
  const [failed, setFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const open = view !== null;

  const teamIds = teams.map(t => t.id).join(',');
  const load = useCallback(() => {
    setFailed(false);
    for (const id of teamIds.split(',')) {
      fetch(`/api/teams/${id}`, { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
          .then((team: TeamWithPlayers) => setLoaded(all => ({ ...all, [id]: team })))
          .catch(() => setFailed(true));
    }
  }, [teamIds]);

  // Ogni volta che si apre si rileggono le squadre; quelle già lette restano a schermo nel frattempo
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura dalla rete all'apertura del pannello
    if (open) load();
  }, [open, load]);

  // Il tabellone sotto non deve scorrere mentre si legge la rosa
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const effects = useMemo(() => prayerEffects(prayers), [prayers]);
  const entriesByTeam = useMemo(() => teamIds.split(',').map(id => {
    const matchPlayers = match ? (id === match.home_team_id ? match.homePlayers : match.awayPlayers) : null;
    const players = rosterEntries(loaded[id]?.players ?? null, matchPlayers, effects);
    const stars = match ? starEntries(id, parseInducements(match.reports.find(r => r.team_id === id)?.inducements)) : [];
    // Nell'ordine dell'elenco, che è anche quello per scorrere le schede: chi gioca, le star, chi non gioca
    return [...players.filter(e => !e.unavailable), ...stars, ...players.filter(e => e.unavailable)];
  }), [loaded, match, teamIds, effects]);
  // Quale squadra: la linguetta scelta, oppure quella del giocatore aperto
  const side = view === OPP || (view !== null && !!entriesByTeam[1]?.some(e => e.id === view)) ? 1 : 0;
  const entries = entriesByTeam[side] ?? [];
  const team = loaded[teams[side]?.id] ?? null;
  const teamName = teams[side]?.name ?? '';

  // Le skill date da un Prayer e quelle delle star non sono su una scheda giocatore: il testo si prende dall'elenco delle skill
  const needsSkillTexts = entries.some(e => e.star || e.effects.some(x => x.skill));
  useEffect(() => {
    if (!open || !needsSkillTexts || allSkills) return;
    fetch('/api/skills').then(r => (r.ok ? r.json() : [])).then(setAllSkills).catch(() => { /* resta il solo nome */ });
  }, [open, needsSkillTexts, allSkills]);

  const player = view && view !== LIST && view !== OPP ? entries.find(e => e.id === view) ?? null : null;
  const showPlayer = !!player;

  // Dall'elenco alla scheda si riparte dall'alto; tornando indietro si ritrova il punto dell'elenco
  useEffect(() => {
    if (!scroller.current) return;
    scroller.current.scrollTop = showPlayer ? 0 : listScroll.current;
  }, [showPlayer, player?.id, side]);

  if (!open) return null;

  const openPlayer = (id: string) => {
    listScroll.current = scroller.current?.scrollTop ?? 0;
    onOpenPlayer(id);
  };
  const title = side === 0 ? L('La mia rosa', 'My roster') : L('Rosa avversaria', 'Opponent roster');
  const playing = entries.filter(e => !e.unavailable && !e.star);
  const stars = entries.filter(e => e.star);
  const out = entries.filter(e => e.unavailable);
  const index = player ? entries.indexOf(player) : -1;
  const previous = index > 0 ? entries[index - 1] : null;
  const next = index >= 0 && index < entries.length - 1 ? entries[index + 1] : null;
  const gp = (n: number) => `${n.toLocaleString(language === 'it' ? 'it-IT' : 'en-GB')} gp`;
  const skillText = (s: Pick<Skill, 'description' | 'description_it'>) => (language === 'it' ? s.description_it || s.description : s.description || s.description_it) ?? '';
  const findSkill = (name: string) => allSkills?.find(s => skillBaseName(s.name).toLowerCase() === skillBaseName(name).toLowerCase()) ?? null;
  const outLabel = (e: RosterEntry) => (e.unavailable === 'mng' ? L('Salta la partita (MNG)', 'Misses this game (MNG)') : 'Temporarily Retiring');
  const jersey = (e: RosterEntry) => (e.star ? '★' : e.jersey_number ?? '·');
  // Le skill delle star sono già scritte come sulla carta ("Loner (4+)"), quelle della scheda squadra in maiuscolo
  const skillNames = (e: RosterEntry) =>
    e.star ? e.star.skills : [...e.skills.map(s => skillLabel(s.name)), ...e.effects.flatMap(x => (x.skill ? [`+ ${x.skill}`] : []))];
  const roleLine = (e: RosterEntry) => (e.star ? `${e.role} · ${e.star.keywords.join(', ')}` : e.role);

  const tags = (e: RosterEntry) => (
      <>
        {e.full?.is_captain && <span className={`tag ${styles.tag}`}>{L('Capitano', 'Captain')}</span>}
        {e.journeyman && <span className={`tag ${styles.tag}`}>Journeyman</span>}
        {e.full && mustAdvance(e.full) && <span className={`tag tag-red ${styles.tag}`}>{L('Deve avanzare', 'Must advance')}</span>}
        {e.effects.length > 0 && <span className={`tag tag-navy ${styles.tag}`}>Prayer</span>}
      </>
  );

  const statStrip = (e: RosterEntry, big = false) => (
      <span className={`${styles.stats} ${big ? styles.statsBig : ''}`} role="group"
        aria-label={STAT_KEYS.map(k => `${statLabel(k)} ${e[k]}`).join(', ')}>
        {STAT_KEYS.map(k => {
          const changed = (k === 'ma' || k === 'av') && e.base[k] !== e[k];
          return (
              <span key={k} className={`${styles.stat} ${changed ? styles.statChanged : ''}`} aria-hidden="true">
                <small>{statLabel(k)}</small>
                <b>{e[k]}</b>
              </span>
          );
        })}
      </span>
  );

  const card = (e: RosterEntry) => (
      <li key={e.id}>
        <button type="button" className={`${styles.card} ${e.unavailable ? styles.cardOut : ''}`} onClick={() => openPlayer(e.id)}>
          <span className={styles.jersey}>{jersey(e)}</span>
          <span className={styles.who}>
            <strong className={styles.name}>{e.name}</strong>
            <span className={styles.role}>
              {roleLine(e)}
              {e.advancements > 0 && <span className={styles.stars} aria-label={L(`${e.advancements} avanzamenti`, `${e.advancements} advancements`)}> {'★'.repeat(e.advancements)}</span>}
            </span>
          </span>
          <ChevronRight size={22} className={styles.chevron} aria-hidden="true" />
          {(e.unavailable || e.full?.is_captain || e.journeyman || e.effects.length > 0 || (e.full && mustAdvance(e.full))) && (
              <span className={styles.tags}>
                {e.unavailable && <span className={`tag tag-red ${styles.tag}`}>{outLabel(e)}</span>}
                {tags(e)}
              </span>
          )}
          {statStrip(e)}
          <span className={styles.skillLine}>
            {skillNames(e).join(', ') || (e.full ? L('Nessuna skill', 'No skills') : '…')}
          </span>
        </button>
      </li>
  );

  return (
      <div className={styles.slide} role="dialog" aria-modal="true" aria-label={showPlayer ? player.name : title}
        style={{ '--team-color': teams[side]?.color ?? undefined } as React.CSSProperties}>
        <header className={styles.bar}>
          <button type="button" className={styles.barBtn} onClick={onBack} aria-label={showPlayer ? L('Torna all’elenco', 'Back to the list') : L('Torna alla partita', 'Back to the match')}>
            {showPlayer ? <ArrowLeft size={24} /> : <X size={24} />}
          </button>
          <div className={styles.barText}>
            <span>{showPlayer ? L('Scheda giocatore', 'Player card') : title}</span>
            <strong>{showPlayer || !entries.length ? teamName : `${teamName} · ${playing.length + stars.length} ${L('giocatori', 'players')}`}</strong>
          </div>
        </header>

        {!showPlayer && teams.length > 1 && (
            <div className={styles.tabs} role="group" aria-label={L('Squadra', 'Team')}>
              {teams.map((t, i) => (
                  <button key={t.id} type="button" aria-pressed={side === i} style={{ '--team-color': t.color ?? undefined } as React.CSSProperties}
                    onClick={() => { if (side !== i) { listScroll.current = 0; onSwap(i === 0 ? LIST : OPP); } }}>
                    <small>{i === 0 ? L('La mia', 'Mine') : L('Avversaria', 'Opponent')}</small>
                    <span>{t.name}</span>
                  </button>
              ))}
            </div>
        )}

        <div className={styles.body} ref={scroller}>
          {failed && (
              <p className={styles.warn} role="alert">
                {team || entries.length
                    ? L('Senza rete: vedi gli ultimi dati caricati.', 'Offline: showing the last data loaded.')
                    : L('Non riesco a caricare la rosa.', 'I could not load the roster.')}
                {' '}<button type="button" onClick={load}>{L('Riprova', 'Retry')}</button>
              </p>
          )}
          {!failed && !team && entries.length === 0 && <p className={styles.loading}>{L('Carico la rosa...', 'Loading the roster...')}</p>}

          {!showPlayer && entries.length > 0 && (
              <>
                {team && (
                    <dl className={styles.teamFacts}>
                      <div><dt>CTV</dt><dd>{Math.round(team.ctv / 1000)}k</dd></div>
                      <div><dt>Re-roll</dt><dd>{team.rerolls}</dd></div>
                      <div><dt>{L('Tesoro', 'Treasury')}</dt><dd>{Math.round(team.treasury / 1000)}k</dd></div>
                      <div><dt>Ded. Fans</dt><dd>{team.fan_factor}</dd></div>
                      <div><dt>Ass. Coach</dt><dd>{team.assistant_coaches}</dd></div>
                      <div><dt>Cheerl.</dt><dd>{team.cheerleaders}</dd></div>
                      <div><dt>Apoth.</dt><dd>{team.apothecary ? L('Sì', 'Yes') : 'No'}</dd></div>
                      <div><dt>TV</dt><dd>{Math.round(team.tv / 1000)}k</dd></div>
                    </dl>
                )}
                <p className={styles.hint}>{L('Tocca un giocatore per leggere le sue skill per esteso.', 'Tap a player to read their skills in full.')}</p>
                <ul className={styles.list}>{playing.map(card)}</ul>
                {stars.length > 0 && (
                    <>
                      <h2 className={styles.section}>{L('Star Player ingaggiati', 'Star Players hired')}</h2>
                      <ul className={styles.list}>{stars.map(card)}</ul>
                    </>
                )}
                {out.length > 0 && (
                    <>
                      <h2 className={styles.section}>{L('Non giocano oggi', 'Not playing today')}</h2>
                      <ul className={styles.list}>{out.map(card)}</ul>
                    </>
                )}
              </>
          )}

          {showPlayer && (
              <article className={styles.sheet} key={player.id}>
                <header className={styles.hero}>
                  <span className={`${styles.jersey} ${styles.jerseyBig}`}>{jersey(player)}</span>
                  <div className={styles.who}>
                    <h1 className={styles.heroName}>{player.name}</h1>
                    <span className={styles.role}>
                      {roleLine(player)}
                      {player.advancements > 0 && <span className={styles.stars}> {'★'.repeat(player.advancements)}</span>}
                    </span>
                  </div>
                  {(player.unavailable || player.effects.length > 0 || player.journeyman || player.full?.is_captain || (player.full && mustAdvance(player.full))) && (
                      <span className={styles.tags}>
                        {player.unavailable && <span className={`tag tag-red ${styles.tag}`}>{outLabel(player)}</span>}
                        {tags(player)}
                      </span>
                  )}
                </header>

                {statStrip(player, true)}

                {player.effects.length > 0 && (
                    <section className={styles.prayers}>
                      <h2>{L('Solo per questa partita', 'This game only')}</h2>
                      <ul>
                        {player.effects.map((x, i) => (
                            <li key={i}>
                              <b>{x.prayer}</b>
                              {x.av && `: AV ${player.base.av} → ${player.av}`}
                              {x.ma && `: MA ${player.base.ma} → ${player.ma}`}
                              {x.skill && `: + ${x.skill}`}
                            </li>
                        ))}
                      </ul>
                    </section>
                )}

                {player.star && (
                    <section className={`${styles.prayers} ${styles.special}`}>
                      <h2>{player.star.special.name} · {t.stars.frequency[player.star.special.frequency]}</h2>
                      <p>{player.star.special.text[language]}</p>
                    </section>
                )}

                <section>
                  <h2 className={styles.section}>Skill</h2>
                  {player.skills.length === 0 && !player.star && !player.effects.some(x => x.skill) && (
                      <p className={styles.empty}>{player.full ? L('Nessuna skill.', 'No skills.') : L('Skill non disponibili senza rete.', 'Skills unavailable offline.')}</p>
                  )}
                  <ul className={styles.skills}>
                    {player.star?.skills.map(name => {
                      const known = findSkill(name);
                      return (
                          <li key={name}>
                            <h3>{name} {known && <small>{known.type}</small>}</h3>
                            <p>{(known && skillText(known)) || (allSkills ? '—' : '…')}</p>
                          </li>
                      );
                    })}
                    {player.skills.map(s => (
                        <li key={s.id}>
                          <h3>{skillLabel(s.name)} <small>{s.type}</small></h3>
                          <p>{skillText(s) || '—'}</p>
                        </li>
                    ))}
                    {player.effects.filter(x => x.skill).map((x, i) => {
                      const known = findSkill(x.skill!);
                      return (
                          <li key={`prayer-${i}`} className={styles.skillPrayer}>
                            <h3>{x.skill} <small>{x.prayer}</small></h3>
                            <p>{(known && skillText(known)) || L('Data da un Prayer to Nuffle: vale solo per questa partita.', 'Granted by a Prayer to Nuffle: this game only.')}</p>
                          </li>
                      );
                    })}
                  </ul>
                </section>

                {player.star && (
                    <section>
                      <h2 className={styles.section}>{L('Scheda', 'Record')}</h2>
                      <dl className={styles.facts}>
                        <div><dt>{L('Ingaggio', 'Hiring fee')}</dt><dd>{gp(player.star.cost)}</dd></div>
                        <div><dt>{L('Fonte', 'Source')}</dt><dd>{player.star.page ? `Rulebook p. ${player.star.page}` : 'Star Players PDF'}</dd></div>
                        <div className={styles.factWide}><dt>Plays For</dt><dd>{playsForText(player.star.playsFor, language)}</dd></div>
                      </dl>
                    </section>
                )}

                {player.full && (
                    <section>
                      <h2 className={styles.section}>{L('Scheda', 'Record')}</h2>
                      <dl className={styles.facts}>
                        <div><dt>SPP</dt><dd>{player.full.spp}</dd></div>
                        <div>
                          <dt>{L('Avanzamenti', 'Advancements')}</dt>
                          <dd>{player.advancements}/{MAX_ADVANCEMENTS}</dd>
                        </div>
                        {player.advancements < MAX_ADVANCEMENTS && !player.journeyman && (
                            <div className={styles.factWide}>
                              <dt>{L('Prossimo avanzamento', 'Next advancement')}</dt>
                              <dd>{(() => {
                                const tier = ADVANCEMENT_TIERS[player.advancements];
                                return L(
                                    `${tier.randomPrimary} SPP Primary a caso · ${tier.choosePrimary} Primary a scelta · ${tier.chooseSecondary} Secondary · ${tier.stat} caratteristica`,
                                    `${tier.randomPrimary} SPP random Primary · ${tier.choosePrimary} chosen Primary · ${tier.chooseSecondary} Secondary · ${tier.stat} characteristic`);
                              })()}</dd>
                            </div>
                        )}
                        <div><dt>Primary</dt><dd>{categoryLetters(player.full.primary_skills).map(categoryName).join(', ') || '—'}</dd></div>
                        <div><dt>Secondary</dt><dd>{categoryLetters(player.full.secondary_skills).map(categoryName).join(', ') || '—'}</dd></div>
                        <div><dt>{L('Valore', 'Value')}</dt><dd>{gp(player.full.value)}</dd></div>
                        <div><dt>Niggling Injuries</dt><dd>{player.niggling_injuries}</dd></div>
                        {player.full.lasting_injuries > 0 && <div><dt>Lasting Injuries</dt><dd>{player.full.lasting_injuries}</dd></div>}
                        {hatredList(player.full.hatreds).length > 0 && (
                            <div className={styles.factWide}><dt>Hatred</dt><dd>{hatredList(player.full.hatreds).join(', ')}</dd></div>
                        )}
                      </dl>
                    </section>
                )}
              </article>
          )}
        </div>

        {showPlayer && (
            <nav className={styles.pager} aria-label={L('Altri giocatori', 'Other players')}>
              <button type="button" disabled={!previous} onClick={() => previous && onSwap(previous.id)}>
                <ChevronLeft size={22} aria-hidden="true" />
                <span>{previous ? `${jersey(previous)} ${previous.name}` : '—'}</span>
              </button>
              <button type="button" disabled={!next} onClick={() => next && onSwap(next.id)}>
                <span>{next ? `${jersey(next)} ${next.name}` : '—'}</span>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </nav>
        )}
      </div>
  );
}
