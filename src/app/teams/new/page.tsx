'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/brand/PageHeader';
import styles from './NewTeam.module.css';
import CoachPicker, { coachChoicePayload, emptyCoachChoice, isCoachChoiceComplete } from '@/components/CoachPicker';
import { useSeason } from '@/lib/SeasonContext';
import type { Coach } from '@/lib/types';
import { ROSTERS, favouredOptions, getRoster, hasRule } from '@/lib/rosters';
import { DRAFT_BUDGET, LIMITS, STAFF_COSTS } from '@/lib/leagueRules';
import { checkDraft, type DraftInput } from '@/lib/draft';

type DraftRow = { uid: number; position_key: string; name: string; jersey_number: string };

const SORTED_ROSTERS = [...ROSTERS].sort((a, b) => a.name.localeCompare(b.name));
const gp = (value: number) => value.toLocaleString();

export default function NewTeamPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAdmin, authLoading } = useAuth();
  const { activeSeason } = useSeason();
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachChoice, setCoachChoice] = useState(emptyCoachChoice());

  // Allenatori già presenti nel database, per sceglierne uno o crearne uno nuovo
  useEffect(() => {
    fetch('/api/coaches?summary=0')
        .then(res => res.json())
        .then(data => setCoaches(Array.isArray(data) ? data : []))
        .catch(() => setCoaches([]));
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    primary_color: '#2d4a22',
    secondary_color: '#8b0000',
    logo_url: '',
  });

  // Draft (pp. 88-91)
  const [rosterKey, setRosterKey] = useState('');
  const [teamLeague, setTeamLeague] = useState('');
  const [favouredOf, setFavouredOf] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const uidRef = useRef(0);
  const [captainUid, setCaptainUid] = useState<number | null>(null);
  const [staff, setStaff] = useState({ rerolls: 0, assistant_coaches: 0, cheerleaders: 0, apothecary: false, dedicated_fans: 1 });

  const roster = getRoster(rosterKey);
  const favouredChoices = favouredOptions(roster, teamLeague);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setFormData({ ...formData, logo_url: '' });
    }
  };

  const chooseRoster = (key: string) => {
    const next = getRoster(key);
    setRosterKey(key);
    setRows([]);
    setCaptainUid(null);
    setTeamLeague(next?.leagues.length === 1 ? next.leagues[0] : '');
    const favoured = favouredOptions(next, next?.leagues.length === 1 ? next.leagues[0] : '');
    setFavouredOf(favoured.length === 1 ? favoured[0] : '');
    setStaff(s => ({ ...s, apothecary: next?.apothecary ? s.apothecary : false }));
  };

  const chooseLeague = (league: string) => {
    setTeamLeague(league);
    const favoured = favouredOptions(roster, league);
    setFavouredOf(favoured.length === 1 ? favoured[0] : '');
  };

  // Aggiornamenti funzionali: più click rapidi non si perdono
  const addPlayer = (positionKey: string) => {
    const position = roster?.positions.find(p => p.key === positionKey);
    if (!position) return;
    uidRef.current += 1;
    const uid = uidRef.current;
    setRows(prev => {
      const count = prev.filter(r => r.position_key === positionKey).length;
      if (count >= position.max || prev.length >= LIMITS.maxPlayers) return prev;
      return [...prev, { uid, position_key: positionKey, name: `${position.name} ${count + 1}`, jersey_number: '' }];
    });
  };

  const removePlayer = (positionKey: string) => {
    setRows(prev => {
      const last = [...prev].reverse().find(r => r.position_key === positionKey);
      if (!last) return prev;
      setCaptainUid(current => (current === last.uid ? null : current));
      return prev.filter(r => r.uid !== last.uid);
    });
  };

  const draft: DraftInput = useMemo(() => ({
    roster: rosterKey,
    team_league: teamLeague || null,
    favoured_of: favouredOf || null,
    ...staff,
    players: rows.map(r => ({ position_key: r.position_key, name: r.name, jersey_number: r.jersey_number ? Number(r.jersey_number) : null })),
    captain_index: captainUid === null ? null : rows.findIndex(r => r.uid === captainUid),
  }), [rosterKey, teamLeague, favouredOf, staff, rows, captainUid]);
  const check = checkDraft(draft);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCoachChoiceComplete(coachChoice)) {
      alert(t.coachPicker.choose);
      return;
    }
    if (check.errors.length) {
      alert(check.errors.join('\n'));
      return;
    }
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      for (const [key, value] of Object.entries(coachChoicePayload(coachChoice))) {
        if (value) submitData.append(key, value);
      }
      submitData.append('primary_color', formData.primary_color);
      submitData.append('secondary_color', formData.secondary_color);
      submitData.append('draft', JSON.stringify(draft));

      if (logoFile) {
        submitData.append('logo_file', logoFile);
      } else if (formData.logo_url) {
        submitData.append('logo_url', formData.logo_url);
      }

      const res = await fetch('/api/teams', {
        method: 'POST',
        body: submitData,
      });

      if (res.ok) {
        const team = await res.json();
        router.push(`/teams/${team.id}`);
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to create team');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating team');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  if (!isAdmin) {
    return (
        <div>
          <PageHeader title={t.draft.title} icon={<Plus size={44} />} />
          <div className={`card ${styles.deniedCard}`}>
            <p className={styles.deniedText}>{t.auth.adminOnly}</p>
            <Link href="/login" className="btn btn-primary">{t.nav.login}</Link>
          </div>
        </div>
    );
  }

  const stepper = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, hint?: string) => (
      <div className={styles.statInputGroup}>
        <span className={styles.statLabel}>{label}</span>
        <div className={styles.stepper}>
          <button type="button" className={styles.stepBtn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${label} -1`}><Minus size={16} /></button>
          <span className={styles.stepValue}>{value}</span>
          <button type="button" className={styles.stepBtn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} +1`}><Plus size={16} /></button>
        </div>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
  );

  return (
      <div>
        <PageHeader
            title={t.draft.title}
            icon={<Plus size={44} />}
            subtitle={activeSeason ? `${t.seasons.season}: ${activeSeason.name}` : undefined}
        />

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* IDENTITÀ E ROSTER */}
          <section className={`card ${styles.section}`}>
            <h2 className="subhead">Team</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.inputGroup}>
                <label htmlFor="team-name" className={styles.label}>{t.draft.teamName}</label>
                <input
                    id="team-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={styles.inputField}
                    placeholder={t.draft.teamNamePlaceholder}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="team-roster" className={styles.label}>{t.rules.teamRoster}</label>
                <select id="team-roster" required value={rosterKey} onChange={(e) => chooseRoster(e.target.value)} className={styles.inputField}>
                  <option value="">{t.rules.chooseRoster}</option>
                  {SORTED_ROSTERS.map(r => <option key={r.key} value={r.key}>{r.name} (p. {r.page})</option>)}
                </select>
              </div>

              {roster && (
                  <div className={styles.inputGroup}>
                    <label htmlFor="team-league" className={styles.label}>{t.rules.league}</label>
                    <select id="team-league" required value={teamLeague} onChange={(e) => chooseLeague(e.target.value)} className={styles.inputField}>
                      {roster.leagues.length > 1 && <option value="">{t.rules.chooseLeague}</option>}
                      {roster.leagues.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
              )}

              {roster && favouredChoices.length > 0 && (
                  <div className={styles.inputGroup}>
                    <label htmlFor="team-favoured" className={styles.label}>{t.rules.favouredOf}</label>
                    <select id="team-favoured" required value={favouredOf} onChange={(e) => setFavouredOf(e.target.value)} className={styles.inputField}>
                      {favouredChoices.length > 1 && <option value="">{t.rules.chooseFavoured}</option>}
                      {favouredChoices.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
              )}

              {roster && (
                  <p className={`${styles.coachGroup} ${styles.rosterRules}`}>
                    <strong>{t.rules.specialRules}:</strong>{' '}
                    {[...roster.specialRules.map(r => (r === 'Favoured of' && favouredOf ? `Favoured of ${favouredOf}` : r === 'Brawlin Brutes' ? "Brawlin' Brutes" : r)),
                      ...(roster.favouredIfLeague && favouredOf ? [`Favoured of ${favouredOf}`] : [])].join(', ') || t.rules.none}
                    {' · '}Apothecary: {roster.apothecary ? 'YES' : 'NO'}
                  </p>
              )}

              {/* Allenatore della squadra nella stagione in corso */}
              <div className={`${styles.inputGroup} ${styles.coachGroup}`}>
                <label htmlFor="coach-select" className={styles.label}>{t.coachPicker.label}</label>
                <CoachPicker
                    coaches={coaches}
                    value={coachChoice}
                    onChange={setCoachChoice}
                    required
                    selectClassName={styles.inputField}
                    inputClassName={styles.inputField}
                />
              </div>
            </div>
          </section>

          {/* GIOCATORI DAL ROSTER */}
          {roster && (
              <section className={`card ${styles.section}`}>
                <h2 className="subhead">{t.rules.players} ({rows.length} / {LIMITS.maxPlayers})</h2>
                <div className={styles.tableScroll}>
                  <table className={`data-table ${styles.rosterTable}`}>
                    <thead>
                    <tr>
                      <th>{t.rules.qty}</th>
                      <th>{t.rules.position}</th>
                      <th className="num">{t.rules.cost}</th>
                      <th className="num">MA</th>
                      <th className="num">ST</th>
                      <th className="num">AG</th>
                      <th className="num">PA</th>
                      <th className="num">AV</th>
                      <th>Skills &amp; Traits</th>
                      <th>P / S</th>
                    </tr>
                    </thead>
                    <tbody>
                    {roster.positions.map(pos => {
                      const count = rows.filter(r => r.position_key === pos.key).length;
                      return (
                          <tr key={pos.key}>
                            <td>
                              <div className={styles.stepper}>
                                <button type="button" className={styles.stepBtn} onClick={() => removePlayer(pos.key)} disabled={count === 0} aria-label={`${pos.name} -1`}><Minus size={14} /></button>
                                <span className={styles.stepValue}>{count}<small>/{pos.max}</small></span>
                                <button type="button" className={styles.stepBtn} onClick={() => addPlayer(pos.key)} disabled={count >= pos.max || rows.length >= LIMITS.maxPlayers} aria-label={`${pos.name} +1`}><Plus size={14} /></button>
                              </div>
                            </td>
                            <td>
                              <strong>{pos.name}</strong>
                              <span className={styles.keywords}>{pos.keywords.join(', ')}</span>
                            </td>
                            <td className="num">{gp(pos.cost)}</td>
                            <td className="num">{pos.ma}</td>
                            <td className="num">{pos.st}</td>
                            <td className="num">{pos.ag}</td>
                            <td className="num">{pos.pa}</td>
                            <td className="num">{pos.av}</td>
                            <td className={styles.skills}>{pos.skills.join(', ') || '—'}</td>
                            <td>{pos.primary.join('') || '—'} / {pos.secondary.join('') || '—'}</td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
                {roster.groups?.map(g => (
                    <p key={g.label} className={styles.hint}>{g.label}: max {g.max} ({g.positions.map(k => roster.positions.find(p => p.key === k)?.name).join(', ')})</p>
                ))}

                {rows.length > 0 && (
                    <ul className={styles.draftList}>
                      {rows.map(row => {
                        const position = roster.positions.find(p => p.key === row.position_key)!;
                        return (
                            <li key={row.uid} className={styles.draftRow}>
                              <input type="number" min="1" max="99" value={row.jersey_number} placeholder="#"
                                     onChange={e => setRows(rows.map(r => r.uid === row.uid ? { ...r, jersey_number: e.target.value } : r))}
                                     className={`${styles.inputField} ${styles.jerseyInput}`} aria-label="N°" />
                              <input type="text" required value={row.name} aria-label={t.rules.playerName}
                                     onChange={e => setRows(rows.map(r => r.uid === row.uid ? { ...r, name: e.target.value } : r))}
                                     className={styles.inputField} />
                              <span className={styles.draftPosition}>{position.name}</span>
                              {hasRule(roster, 'Team Captain') && !position.keywords.includes('Big Guy') && (
                                  <label className={styles.captainPick}>
                                    <input type="radio" name="captain" checked={captainUid === row.uid} onChange={() => setCaptainUid(row.uid)} />
                                    {t.rules.captain}
                                  </label>
                              )}
                            </li>
                        );
                      })}
                    </ul>
                )}
                {hasRule(roster, 'Team Captain') && (
                    <p className={styles.hint}>
                      {t.rules.captain}: {t.rules.captainHint}{' '}
                      {captainUid !== null && <button type="button" className={styles.linkBtn} onClick={() => setCaptainUid(null)}>{t.rules.noCaptain}</button>}
                    </p>
                )}
              </section>
          )}

          {/* STAFF */}
          {roster && (
              <section className={`card ${styles.section}`}>
                <h2 className="subhead">{t.rules.staff}</h2>
                <div className={styles.statsGrid}>
                  {stepper(t.rules.rerollsEach.replace('{cost}', gp(roster.rerollCost)), staff.rerolls, 0, LIMITS.maxRerolls, v => setStaff({ ...staff, rerolls: v }))}
                  {stepper(`${t.rules.assistantCoach} (${gp(STAFF_COSTS.assistantCoach)})`, staff.assistant_coaches, 0, LIMITS.maxAssistantCoaches, v => setStaff({ ...staff, assistant_coaches: v }))}
                  {stepper(`${t.rules.cheerleader} (${gp(STAFF_COSTS.cheerleader)})`, staff.cheerleaders, 0, LIMITS.maxCheerleaders, v => setStaff({ ...staff, cheerleaders: v }))}
                  {stepper(t.rules.dedicatedFansDraft, staff.dedicated_fans, LIMITS.dedicatedFansStart, LIMITS.dedicatedFansDraftMax, v => setStaff({ ...staff, dedicated_fans: v }))}
                  <label className={styles.apothecaryCheck}>
                    <span className={styles.statLabel}>{t.rules.apothecary} ({gp(STAFF_COSTS.apothecary)})</span>
                    <input type="checkbox" checked={staff.apothecary} disabled={!roster.apothecary} onChange={e => setStaff({ ...staff, apothecary: e.target.checked })} className={styles.checkbox} />
                    {!roster.apothecary && <span className={styles.hint}>{t.rules.apothecaryNotAllowed}</span>}
                  </label>
                </div>
              </section>
          )}

          {/* COLORI E LOGO */}
          <section className={`card ${styles.section}`}>
            <h2 className="subhead">Colors &amp; Logo</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.inputGroup}>
                <label htmlFor="team-primary" className={styles.label}>{t.draft.primaryColor}</label>
                <input
                    id="team-primary"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                    className={styles.colorPicker}
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="team-secondary" className={styles.label}>{t.draft.secondaryColor}</label>
                <input
                    id="team-secondary"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({...formData, secondary_color: e.target.value})}
                    className={styles.colorPicker}
                />
              </div>
            </div>

            <div className={`${styles.inputGroup} ${styles.logoGroup}`}>
              <label htmlFor="team-logo-url" className={styles.label}>{t.draft.logoUrl}</label>
              <div className={styles.logoRow}>
                <div className={styles.logoInputs}>
                  <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className={styles.fileInput}
                  />
                  <input
                      id="team-logo-url"
                      type="url"
                      value={formData.logo_url}
                      onChange={(e) => {
                        setFormData({...formData, logo_url: e.target.value});
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className={styles.inputField}
                      placeholder="https://..."
                  />
                </div>

                {(logoPreview || formData.logo_url) && (
                    <div className={styles.logoPreview} style={{ borderColor: formData.primary_color }}>
                      <img src={logoPreview || formData.logo_url} alt="Preview" />
                    </div>
                )}
              </div>
            </div>
          </section>

          {/* BUDGET */}
          <section className={`card ${styles.section} ${styles.budget}`} aria-live="polite">
            <div className={styles.budgetFigures}>
              <span><small>{t.rules.budget}</small><strong>{gp(DRAFT_BUDGET)}</strong></span>
              <span><small>{t.rules.spent}</small><strong>{gp(check.total)}</strong></span>
              <span className={check.remaining < 0 ? styles.over : ''}><small>{t.rules.remaining}</small><strong>{gp(check.remaining)}</strong></span>
            </div>
            <p className={styles.hint}>{t.rules.houseRuleBudget.replace('{budget}', gp(DRAFT_BUDGET))}</p>
            {check.errors.length > 0 ? (
                <div className={styles.errors}>
                  <strong>{t.rules.draftErrors}</strong>
                  <ul>{check.errors.map(err => <li key={err}>{err}</li>)}</ul>
                </div>
            ) : (
                <p className={styles.ok}>{t.rules.draftOk}</p>
            )}
          </section>

          <div className={styles.actionButtons}>
            <button type="button" onClick={() => router.back()} className="btn">CANCEL</button>
            <button type="submit" className="btn btn-primary" disabled={loading || check.errors.length > 0}>
              {loading ? t.draft.drafting : t.draft.registerBtn}
            </button>
          </div>
        </form>
      </div>
  );
}
