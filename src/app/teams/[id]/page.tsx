'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CoachPicker, { coachChoicePayload, emptyCoachChoice, isCoachChoiceComplete } from '@/components/CoachPicker';
import { ShieldAlert, Trash2, Plus, Edit2, Save, X, Skull, ArrowUpCircle, Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/brand/PageHeader';
import SectionTitle from '@/components/brand/SectionTitle';
import Shards from '@/components/brand/Shards';
import styles from './TeamDetails.module.css';
import { ADVANCEMENT_TIERS, MAX_ADVANCEMENTS, skillsForCategories } from '@/lib/advancement';
import { isTrue, type Coach, type Player, type Skill, type TeamWithPlayers } from '@/lib/types';

export default function TeamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useLanguage();
  const { isAdmin } = useAuth();

  const [team, setTeam] = useState<TeamWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  // STATO GLOBALE DELLE SKILL (Dizionario)
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  // Team edit form
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', primary_color: '', secondary_color: '', logo_url: '',
    rerolls: 0, reroll_cost: 50000, cheerleaders: 0, assistant_coaches: 0, fan_factor: 0, apothecary: false,
    treasury: 0, bank: 0
  });
  // Allenatore nella stagione attiva (modificabile solo se la squadra partecipa)
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachChoice, setCoachChoice] = useState(emptyCoachChoice());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Player forms
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Level Up State
  const [levelUpPlayer, setLevelUpPlayer] = useState<Player | null>(null);
  const [levelUpChoice, setLevelUpChoice] = useState<string>('');
  const [selectedAdvancement, setSelectedAdvancement] = useState<Skill | null>(null);

  // NUOVO STATO: Modale Celebrazione Skill Random
  const [celebrationSkill, setCelebrationSkill] = useState<Skill | null>(null);

  // Autocomplete State (Solo per la Creazione)
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<Skill[]>([]);

  const [editPlayerForm, setEditPlayerForm] = useState({
    jersey_number: '', name: '', role: '', value: 0,
    primary_skills: '', secondary_skills: '', advancements: 0,
    skills: [] as Skill[],
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0,
    mng: false, dead: false
  });

  const [playerForm, setPlayerForm] = useState({
    jersey_number: '', name: '', role: 'Lineman', value: 50000, skills: [] as Skill[],
    primary_skills: 'G', secondary_skills: 'A', // Default per non lasciarlo vuoto
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0
  });

  const fetchTeamAndSkills = useCallback(async () => {
    try {
      const [teamRes, skillsRes] = await Promise.all([
        fetch(`/api/teams/${id}`),
        fetch('/api/skills')
      ]);

      if (!teamRes.ok) throw new Error('Team not found');

      const teamData = await teamRes.json();
      const skillsData = await skillsRes.json();

      setTeam(teamData);
      setAvailableSkills(skillsData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      router.push('/teams');
    }
  }, [id, router]);

  useEffect(() => {
    fetchTeamAndSkills();
  }, [fetchTeamAndSkills]);

  const formatSkillName = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // --- AUTOCOMPLETAMENTO (Solo Creazione) ---
  const handleSkillInputChange = (value: string) => {
    const input = value;
    setSkillInput(input);
    if (input.trim() === '') return setSkillSuggestions([]);

    const filtered = availableSkills.filter(skill =>
        skill.name.toLowerCase().includes(input.toLowerCase()) &&
        !playerForm.skills.some(s => s.id === skill.id)
    );
    setSkillSuggestions(filtered);
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const inputVal = skillInput;
      if (!inputVal.trim()) return;

      const exactMatch = availableSkills.find(s => s.name.toLowerCase() === inputVal.trim().toLowerCase());
      if (!exactMatch) return alert(`ATTENZIONE: La skill "${inputVal}" non esiste nel regolamento!`);
      if (playerForm.skills.some(s => s.id === exactMatch.id)) return alert(`Già posseduta.`);

      addSkillToPlayer(exactMatch);
    }
  };

  const addSkillToPlayer = (skill: Skill) => {
    if (!playerForm.skills.some(s => s.id === skill.id)) {
      setPlayerForm({ ...playerForm, skills: [...playerForm.skills, skill] });
    }
    setSkillInput('');
    setSkillSuggestions([]);
  };

  const removeSkillFromPlayer = (skill: Skill) => {
    if (!confirm(`Rimuovere "${formatSkillName(skill.name)}"?`)) return;
    setPlayerForm({ ...playerForm, skills: playerForm.skills.filter(s => s.id !== skill.id) });
  };
  // -----------------------------------

  // --- FUNZIONE PER FILTRARE LE SKILL DEL LEVEL UP ---
  const getFilteredSkillsForLevelUp = (type: 'primary' | 'secondary') => {
    if (!levelUpPlayer) return [];

    return skillsForCategories(
        availableSkills,
        type === 'primary' ? levelUpPlayer.primary_skills : levelUpPlayer.secondary_skills,
        levelUpPlayer.skills.map(ps => ps.id)
    );
  };

  // Costi, limiti e valori sono calcolati dal server (/api/players/[id]/advance)
  const requestAdvancement = async (payload: Record<string, string>) => {
    if (!levelUpPlayer) return null;
    try {
      const res = await fetch(`/api/players/${levelUpPlayer.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Errore durante l\'avanzamento');
        return null;
      }
      setLevelUpPlayer(null); setSelectedAdvancement(null); setLevelUpChoice('');
      fetchTeamAndSkills();
      return data;
    } catch {
      alert('Errore di connessione');
      return null;
    }
  };

  // --- TENTATIVO CASUALE: il server estrae la skill, qui mostriamo la celebrazione ---
  const handleRandomRoll = async () => {
    const data = await requestAdvancement({ kind: 'randomPrimary' });
    if (data?.skill) setCelebrationSkill(data.skill);
  };

  // --- LOGICA LEVEL UP STANDARD (Scelta Manuale) ---
  const handleLevelUpSave = async () => {
    if (!levelUpChoice) return alert('Seleziona un potenziamento!');

    if (levelUpChoice === 'choosePrimary' || levelUpChoice === 'chooseSecondary') {
      if (!selectedAdvancement) return alert('Seleziona una skill!');
      await requestAdvancement({ kind: levelUpChoice, skill_id: selectedAdvancement.id });
    } else if (levelUpChoice.startsWith('stat_')) {
      await requestAdvancement({ kind: 'stat', stat: levelUpChoice.split('_')[1] });
    }
  };
  // -----------------------

  const handleDeleteTeam = async () => {
    if (!team || !confirm(t.teamDetail.confirmDisband.replace('{teamName}', team.name))) return;
    try {
      const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/teams');
      else alert('Failed to delete team');
    } catch { alert('Failed to delete team'); }
  };

  const openEditTeam = () => {
    if (!team) return;
    setEditForm({
      name: team.name, primary_color: team.primary_color || '#000000', secondary_color: team.secondary_color || '#000000', logo_url: team.logo_url || '',
      rerolls: team.rerolls || 0, reroll_cost: team.reroll_cost || 50000, cheerleaders: team.cheerleaders || 0, assistant_coaches: team.assistant_coaches || 0,
      fan_factor: team.fan_factor || 0, apothecary: isTrue(team.apothecary), treasury: team.treasury || 0, bank: team.bank || 0
    });
    setCoachChoice(emptyCoachChoice(team.in_active_season ? team.coach_id ?? '' : ''));
    fetch('/api/coaches?summary=0')
        .then(res => res.json())
        .then(data => setCoaches(Array.isArray(data) ? data : []))
        .catch(() => setCoaches([]));
    setLogoFile(null); setLogoPreview(null); setShowEditTeam(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); setEditForm({ ...editForm, logo_url: '' }); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingTeam(true);
    try {
      const submitData = new FormData();
      submitData.append('name', editForm.name); submitData.append('primary_color', editForm.primary_color); submitData.append('secondary_color', editForm.secondary_color);
      submitData.append('rerolls', editForm.rerolls.toString()); submitData.append('reroll_cost', editForm.reroll_cost.toString()); submitData.append('cheerleaders', editForm.cheerleaders.toString());
      submitData.append('assistant_coaches', editForm.assistant_coaches.toString()); submitData.append('fan_factor', editForm.fan_factor.toString()); submitData.append('apothecary', editForm.apothecary.toString());
      submitData.append('treasury', editForm.treasury.toString()); submitData.append('bank', editForm.bank.toString());

      // Il cambio allenatore si invia solo se la squadra partecipa alla stagione attiva
      if (team?.in_active_season) {
        if (coachChoice.isNew && !isCoachChoiceComplete(coachChoice)) { alert(t.coachPicker.newCoachName); return; }
        const coachFields = coachChoicePayload(coachChoice);
        if (coachFields.new_coach_name) submitData.append('new_coach_name', coachFields.new_coach_name);
        else submitData.append('coach_id', coachFields.coach_id ?? '');
      }

      if (logoFile) submitData.append('logo_file', logoFile);
      else if (editForm.logo_url) submitData.append('logo_url', editForm.logo_url);
      else submitData.append('logo_url', '');

      const res = await fetch(`/api/teams/${id}`, { method: 'PUT', body: submitData });
      if (res.ok) { setShowEditTeam(false); fetchTeamAndSkills(); }
      else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Failed to update team');
      }
    } catch { alert('Error updating team'); }
    finally { setIsEditingTeam(false); }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const skillIds = playerForm.skills.map(s => s.id);

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: id, jersey_number: playerForm.jersey_number ? Number(playerForm.jersey_number) : null,
          name: playerForm.name, role: playerForm.role, value: Number(playerForm.value),
          primary_skills: playerForm.primary_skills, secondary_skills: playerForm.secondary_skills, // INVIAMO P/S SKILLS
          skills: skillIds, ma: Number(playerForm.ma), st: Number(playerForm.st), ag: playerForm.ag, pa: playerForm.pa, av: playerForm.av,
          spp: Number(playerForm.spp), mng: false, dead: false
        })
      });

      if (res.ok) {
        setPlayerForm({ jersey_number: '', name: '', role: 'Lineman', value: 50000, skills: [], primary_skills: 'G', secondary_skills: 'A', ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0 });
        setShowPlayerForm(false);
        fetchTeamAndSkills();
      } else { alert('Failed to hire player'); }
    } catch { alert('Error hiring player'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!confirm(t.teamDetail.confirmFire.replace('{playerName}', name))) return;
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: 'DELETE' });
      if (!res.ok) alert('Failed to fire player');
      fetchTeamAndSkills();
    } catch { alert('Failed to fire player'); }
  };

  const startEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      jersey_number: player.jersey_number != null ? String(player.jersey_number) : '', name: player.name, role: player.role, value: player.value,
      primary_skills: player.primary_skills || '', secondary_skills: player.secondary_skills || '', advancements: player.advancements || 0,
      skills: player.skills || [], // Le skills originali (non verranno modificate dalla UI)
      ma: player.ma ?? 6, st: player.st ?? 3, ag: player.ag ?? '3+', pa: player.pa ?? '4+', av: player.av ?? '8+',
      spp: player.spp ?? 0, mng: isTrue(player.mng), dead: isTrue(player.dead)
    });
  };

  const handleSavePlayerEdit = async (playerId: string) => {
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jersey_number: editPlayerForm.jersey_number ? Number(editPlayerForm.jersey_number) : null,
          name: editPlayerForm.name, role: editPlayerForm.role, value: Number(editPlayerForm.value),
          primary_skills: editPlayerForm.primary_skills, secondary_skills: editPlayerForm.secondary_skills, advancements: editPlayerForm.advancements,
          ma: Number(editPlayerForm.ma), st: Number(editPlayerForm.st), ag: editPlayerForm.ag, pa: editPlayerForm.pa, av: editPlayerForm.av,
          mng: editPlayerForm.mng, dead: editPlayerForm.dead
          // NOTA BENE: Non inviamo "skills" né "spp", così il backend non li tocca!
        })
      });

      if (res.ok) { setEditingPlayerId(null); fetchTeamAndSkills(); }
      else { alert('Failed to update player'); }
    } catch { alert('Error updating player'); }
  };

  if (loading || !team) return <div className="loading-state">Loading locker room...</div>;

  const activePlayers = team.players.filter(p => !isTrue(p.dead));

  const staffValue =
      ((team.rerolls || 0) * (team.reroll_cost || 50000)) +
      ((team.cheerleaders || 0) * 10000) +
      ((team.assistant_coaches || 0) * 10000) +
      ((team.fan_factor || 0) * 10000) +
      (team.apothecary ? 50000 : 0);

  const totalValue = activePlayers.reduce((sum, p) => sum + p.value, 0) + staffValue;

  const sortedPlayers = [...team.players].sort((a, b) => {
    const aDead = isTrue(a.dead);
    const bDead = isTrue(b.dead);
    if (aDead && !bDead) return 1;
    if (!aDead && bDead) return -1;
    return (a.jersey_number || 99) - (b.jersey_number || 99);
  });

  // Colore squadra usato solo come accento (filetti e bordi), mai come fondo del testo
  const teamAccent = { '--team-accent': team.primary_color || 'var(--bb-mustard)', '--team-accent-2': team.secondary_color || 'var(--bb-tan)' } as React.CSSProperties;

  const tier = levelUpPlayer ? ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)] : null;
  const choiceClass = (active: boolean) => `btn ${active ? 'btn-navy' : ''} ${styles.choiceBtn}`;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Righe etichetta/valore della scheda profilo (stile scheda personaggio)
  const profileRows: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    {
      label: t.coachPicker.label,
      value: team.coach_id
          ? <Link href={`/coaches/${team.coach_id}`} className={styles.coachLink}>{team.coach_name}</Link>
          : <span>—</span>,
    },
    { label: t.draft.race, value: team.race },
    {
      label: `${t.draft.primaryColor} / ${t.draft.secondaryColor}`,
      value: (
          <span className={styles.colours}>
            <span className={styles.swatch} style={{ background: team.primary_color || undefined }} aria-label={team.primary_color || '-'} />
            <span className={styles.swatch} style={{ background: team.secondary_color || undefined }} aria-label={team.secondary_color || '-'} />
          </span>
      ),
    },
    { label: 'Cheerleaders', value: team.cheerleaders || 0 },
    { label: 'Assistant Coaches', value: team.assistant_coaches || 0 },
    { label: 'Apothecary', value: team.apothecary ? 'Yes' : 'No' },
  ];

  return (
      <div className={styles.page} style={teamAccent}>

        {/* MODALE DI CELEBRAZIONE SKILL CASUALE */}
        {celebrationSkill && (
            <div className={styles.overlay} role="dialog" aria-modal="true">
              <div className={`panel-blood chamfer ${styles.celebration}`}>
                <span className={styles.modalMicro}><i className={styles.microSquares} aria-hidden="true" />Nuffle // Random roll</span>
                <Dices size={64} className={styles.celebrationIcon} aria-hidden="true" />
                <h2 className="title-spike">NUFFLE HAS SPOKEN!</h2>
                <p className={styles.celebrationText}>The dice rolled in your favor...</p>

                <div className={`intro-box ${styles.celebrationSkill}`}>
                  <span className={styles.celebrationSkillName}>{formatSkillName(celebrationSkill.name)}</span>
                  <span className={styles.celebrationSkillType}>({celebrationSkill.type})</span>
                </div>

                <button className="btn btn-gold" onClick={() => setCelebrationSkill(null)}>
                  <span>ACCEPT GLORY</span>
                </button>
              </div>
            </div>
        )}

        {/* TESTATA SQUADRA */}
        <PageHeader
            title={team.name}
            kicker={team.race}
            icon={
              <span className={styles.logoFrame}>
                {team.logo_url ? (
                    <img src={team.logo_url} alt="" className={styles.teamLogo} />
                ) : (
                    <ShieldAlert size={40} className={styles.logoFallback} />
                )}
              </span>
            }
            subtitle={<>{t.teamDetail.teamValue}: <strong>{totalValue.toLocaleString()} GP</strong></>}
            actions={isAdmin ? (
                <>
                  <button className="btn" onClick={openEditTeam}><Edit2 size={18} /><span>EDIT</span></button>
                  <button className="btn btn-primary" onClick={handleDeleteTeam}><Trash2 size={18} /><span>DISBAND</span></button>
                </>
            ) : undefined}
        />

        {/* PROFILO SQUADRA (scheda personaggio) */}
        <section className={`bleed ${styles.profileBand}`} aria-labelledby="team-profile-name">
          <Shards variant="header" className={styles.profileShards} />
          <span className={`ghost-text ${styles.ghostRace}`} aria-hidden="true">{team.race}</span>

          <div className={styles.profileInner}>
            <div className={styles.portrait}>
              <span className={styles.portraitShard} aria-hidden="true" />
              <span className={styles.portraitCount} aria-hidden="true">{pad(activePlayers.length)}</span>
              <span className={styles.portraitMicro} aria-hidden="true">{`Roster // ${activePlayers.length} of 16`}</span>

              <span className={styles.badge}>
                {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className={styles.badgeLogo} />
                ) : (
                    <ShieldAlert size={120} className={styles.badgeFallback} />
                )}
              </span>

              <span className={`tag ${styles.portraitRace}`}>{team.race}</span>

              <span className={`chamfer ${styles.portraitValue}`}>
                <small>{t.teamDetail.teamValue}</small>
                <strong>{totalValue.toLocaleString()} <em>GP</em></strong>
              </span>
            </div>

            <div className={styles.dossier}>
              <span className={styles.micro}>
                <i className={styles.microSquares} aria-hidden="true" />
                {`Team profile // ${team.race}`}
              </span>
              <h2 id="team-profile-name" className={styles.dossierName}>{team.name}</h2>

              <dl className={styles.labelRows}>
                {profileRows.map(row => (
                    <div key={row.label} className={styles.labelRow}>
                      <dt className={`chamfer ${styles.labelChip}`}>{row.label}</dt>
                      <dd className={styles.labelValue}>{row.value}</dd>
                    </div>
                ))}
                {team.season_history.length > 0 && (
                    <div className={`${styles.labelRow} ${styles.labelRowWide}`}>
                      <dt className={`chamfer ${styles.labelChip}`}>{t.seasons.season}</dt>
                      <dd className={`${styles.labelValue} ${styles.seasonHistory}`}>
                        {team.season_history.map(h => (
                            <span
                                key={h.season_id}
                                className={`chamfer ${styles.historyChip} ${h.season_status === 'active' ? styles.historyChipActive : ''}`}
                                title={({ active: t.seasons.active, completed: t.seasons.completed, paused: t.seasons.paused, cancelled: t.seasons.cancelled })[h.season_status]}
                            >
                              {h.season_name}: {h.coach_name ?? '—'}
                            </span>
                        ))}
                      </dd>
                    </div>
                )}
              </dl>
            </div>
          </div>

          <ul className={styles.plates}>
            <li className={`plate ${styles.plateItem}`}>
              <span className={styles.plateValue}>{team.rerolls || 0}</span>
              <span className={styles.plateLabel}>Rerolls</span>
            </li>
            <li className={`plate ${styles.plateItem}`}>
              <span className={styles.plateValue}>{team.fan_factor || 0}</span>
              <span className={styles.plateLabel}>Fans</span>
            </li>
            <li className={`plate ${styles.plateItem}`}>
              <span className={styles.plateValue}>{(team.treasury || 0).toLocaleString()}</span>
              <span className={styles.plateLabel}>Treasury (GP)</span>
            </li>
            <li className={`plate ${styles.plateItem}`}>
              <span className={styles.plateValue}>{(team.bank || 0).toLocaleString()}</span>
              <span className={styles.plateLabel}>Bank (GP)</span>
            </li>
          </ul>
        </section>

        {/* MODALITÀ LEVEL UP (POPUP CENTRALE CON BOTTONI DISABILITABILI) */}
        {levelUpPlayer && tier && (
            <div className={styles.overlay} role="dialog" aria-modal="true">
              <div className={`card chamfer ${styles.modal}`}>
                <span className={`${styles.modalMicro} ${styles.modalMicroLight}`}><i className={styles.microSquares} aria-hidden="true" />SPP // Advancement</span>
                <div className={styles.modalHeader}>
                  <h3 className={`subhead ${styles.modalTitle}`}>
                    SPP ADVANCEMENT: {levelUpPlayer.name}
                  </h3>
                  <button onClick={() => { setLevelUpPlayer(null); setLevelUpChoice(''); setSelectedAdvancement(null); }} className={styles.iconBtn} title="Close" aria-label="Close"><X size={24}/></button>
                </div>

                <div className={`chamfer ${styles.sppStrip}`}>
                  <span>CURRENT SPP: <strong className={styles.sppValue}>{levelUpPlayer.spp}</strong></span>
                  <span>ADVANCEMENTS: <strong>{levelUpPlayer.advancements || 0} / 6</strong></span>
                </div>

                <div className={styles.choiceGrid}>
                  {/* Calcolo disponibilità pulsanti in base al database */}
                  <button
                      className={choiceClass(levelUpChoice === 'randomPrimary')}
                      disabled={!levelUpPlayer.primary_skills}
                      onClick={handleRandomRoll}
                  >
                    <span>Random Primary ({tier.randomPrimary} SPP)</span>
                  </button>
                  <button
                      className={choiceClass(levelUpChoice === 'choosePrimary')}
                      disabled={!levelUpPlayer.primary_skills}
                      onClick={() => setLevelUpChoice('choosePrimary')}
                  >
                    <span>Choose Primary ({tier.choosePrimary} SPP)</span>
                  </button>
                  <button
                      className={choiceClass(levelUpChoice === 'chooseSecondary')}
                      disabled={!levelUpPlayer.secondary_skills}
                      onClick={() => setLevelUpChoice('chooseSecondary')}
                  >
                    <span>Choose Secondary ({tier.chooseSecondary} SPP)</span>
                  </button>
                  <button
                      className={choiceClass(levelUpChoice.startsWith('stat_'))}
                      onClick={() => setLevelUpChoice('stat_ma')}
                  >
                    <span>Characteristic ({tier.stat} SPP)</span>
                  </button>
                </div>

                {(levelUpChoice === 'choosePrimary' || levelUpChoice === 'chooseSecondary') && (
                    <select onChange={(e) => setSelectedAdvancement(availableSkills.find(s => s.id === e.target.value) ?? null)} className={`${styles.inputField} ${styles.modalSelect}`}>
                      <option value="">Select a skill...</option>
                      {getFilteredSkillsForLevelUp(levelUpChoice === 'choosePrimary' ? 'primary' : 'secondary').map(s => (
                          <option key={s.id} value={s.id}>{formatSkillName(s.name)} ({s.type})</option>
                      ))}
                    </select>
                )}

                {levelUpChoice.startsWith('stat_') && (
                    <div className={styles.statChoices}>
                      <button className={choiceClass(levelUpChoice === 'stat_ma')} onClick={() => setLevelUpChoice('stat_ma')}><span>+MA</span></button>
                      <button className={choiceClass(levelUpChoice === 'stat_st')} onClick={() => setLevelUpChoice('stat_st')}><span>+ST</span></button>
                      <button className={choiceClass(levelUpChoice === 'stat_ag')} onClick={() => setLevelUpChoice('stat_ag')}><span>+AG</span></button>
                      <button className={choiceClass(levelUpChoice === 'stat_pa')} onClick={() => setLevelUpChoice('stat_pa')}><span>+PA</span></button>
                      <button className={choiceClass(levelUpChoice === 'stat_av')} onClick={() => setLevelUpChoice('stat_av')}><span>+AV</span></button>
                    </div>
                )}

                <button
                    className={`btn btn-primary ${styles.fullWidth}`}
                    onClick={handleLevelUpSave}
                    disabled={levelUpChoice === '' || levelUpChoice === 'randomPrimary'} // Non usare per il random
                >
                  <span>CONFIRM MANUAL ADVANCEMENT</span>
                </button>
              </div>
            </div>
        )}

        {/* EDIT TEAM FORM */}
        {showEditTeam && (
            <div className={`card ${styles.formCard} ${styles.editCard}`}>
              <h3 className="subhead">UPDATE TEAM DOSSIER</h3>
              <form onSubmit={handleEditSubmit}>
                <div className={styles.grid3Col}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.teamDetail.name}</label>
                    <input type="text" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={styles.inputField} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.draft.primaryColor}</label>
                    <input type="color" value={editForm.primary_color} onChange={e => setEditForm({...editForm, primary_color: e.target.value})} className={styles.colorInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.draft.secondaryColor}</label>
                    <input type="color" value={editForm.secondary_color} onChange={e => setEditForm({...editForm, secondary_color: e.target.value})} className={styles.colorInput} />
                  </div>
                </div>

                <div className={styles.gridStats}>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.rerolls}</label>
                    <input type="number" min="0" max="8" value={editForm.rerolls} onChange={e => setEditForm({...editForm, rerolls: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>R. COST</label>
                    <input type="number" min="0" step="10000" value={editForm.reroll_cost} onChange={e => setEditForm({...editForm, reroll_cost: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.cheerleaders}</label>
                    <input type="number" min="0" max="16" value={editForm.cheerleaders} onChange={e => setEditForm({...editForm, cheerleaders: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>ASST. COACHES</label>
                    <input type="number" min="0" max="16" value={editForm.assistant_coaches} onChange={e => setEditForm({...editForm, assistant_coaches: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.fanFactor}</label>
                    <input type="number" min="0" max="18" value={editForm.fan_factor} onChange={e => setEditForm({...editForm, fan_factor: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={`${styles.inputGroup} ${styles.checkGroup}`}>
                    <label className={styles.checkLabel}>
                      <span>APOTHECARY</span>
                      <input type="checkbox" checked={editForm.apothecary} onChange={e => setEditForm({...editForm, apothecary: e.target.checked})} className={styles.checkbox} />
                    </label>
                  </div>
                </div>

                <div className={styles.grid3Col}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.teamDetail.treasury}</label>
                    <input type="number" min="0" step="10000" value={editForm.treasury} onChange={e => setEditForm({...editForm, treasury: parseInt(e.target.value) || 0})} className={styles.inputField} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.teamDetail.bank}</label>
                    <input type="number" min="0" step="10000" value={editForm.bank} onChange={e => setEditForm({...editForm, bank: parseInt(e.target.value) || 0})} className={styles.inputField} />
                  </div>
                </div>

                {team.in_active_season && (
                    <div className={`${styles.inputGroup} ${styles.blockGap}`}>
                      <label className={styles.label} htmlFor="team-coach-select">{t.coachPicker.label}</label>
                      <CoachPicker
                          idPrefix="team-coach"
                          coaches={coaches}
                          value={coachChoice}
                          onChange={setCoachChoice}
                          allowNone
                          selectClassName={styles.inputField}
                          inputClassName={styles.inputField}
                      />
                    </div>
                )}

                <div className={`${styles.inputGroup} ${styles.blockGap}`}>
                  <label className={styles.label}>{t.draft.logoUrl}</label>
                  <div className={styles.logoRow}>
                    <div className={styles.logoInputs}>
                      <input type="file" accept="image/*" onChange={handleLogoChange} className={styles.fileInput} />
                      <input type="url" value={editForm.logo_url} onChange={(e) => { setEditForm({...editForm, logo_url: e.target.value}); setLogoFile(null); setLogoPreview(null); }} className={styles.inputField} placeholder="https://..." />
                    </div>
                    {(logoPreview || editForm.logo_url) && (
                        <div className={styles.logoPreview}>
                          <img src={logoPreview || editForm.logo_url} alt="Preview" />
                        </div>
                    )}
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button type="button" className="btn" onClick={() => setShowEditTeam(false)}><span>CANCEL</span></button>
                  <button type="submit" className="btn btn-primary" disabled={isEditingTeam}>
                    <span>{isEditingTeam ? 'SAVING...' : 'SAVE DOSSIER'}</span>
                  </button>
                </div>
              </form>
            </div>
        )}

        {/* 01 · ROSTER DELLA SQUADRA (fascia chiara) */}
        <section className={`bleed ${styles.rosterBand}`}>
          <span className={`ghost-text on-light ${styles.ghostRoster}`} aria-hidden="true">Roster</span>

          <div className={styles.inner}>
            <SectionTitle
                index="01"
                on="light"
                micro={`Roster sheet // ${activePlayers.length} of 16`}
                title={`ROSTER (${activePlayers.length} / 16)`}
                action={isAdmin && !showPlayerForm && activePlayers.length < 16 ? (
                    <button className="btn btn-primary" onClick={() => setShowPlayerForm(true)}>
                      <Plus size={20} /><span>{t.teamDetail.hirePlayer}</span>
                    </button>
                ) : undefined}
            />

            {/* ADD PLAYER FORM */}
            {showPlayerForm && (
                <div className={`card ${styles.formCard}`}>
                  <h3 className="subhead">NEW RECRUIT CONTRACT</h3>
                  <form onSubmit={handleAddPlayer}>
                    <div className={styles.grid4Col}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>N°</label>
                        <input type="number" value={playerForm.jersey_number} onChange={e => setPlayerForm({...playerForm, jersey_number: e.target.value})} className={`${styles.inputField} ${styles.center}`} placeholder="##" />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>{t.teamDetail.name}</label>
                        <input type="text" required value={playerForm.name} onChange={e => setPlayerForm({...playerForm, name: e.target.value})} className={styles.inputField} placeholder="Player Name" />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>{t.teamDetail.role}</label>
                        <input type="text" required value={playerForm.role} onChange={e => setPlayerForm({...playerForm, role: e.target.value})} className={styles.inputField} placeholder="e.g. Blitzer" />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>{t.teamDetail.value}</label>
                        <input type="number" required value={playerForm.value} onChange={e => setPlayerForm({...playerForm, value: Number(e.target.value)})} className={styles.inputField} />
                      </div>
                    </div>

                    {/* GESTIONE CATEGORIE SKILL */}
                    <div className={styles.grid2Col}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>PRIMARY SKILLS (es. G, A)</label>
                        <input type="text" required value={playerForm.primary_skills} onChange={e => setPlayerForm({...playerForm, primary_skills: e.target.value})} className={styles.inputField} placeholder="G, A" />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>SECONDARY SKILLS (es. S, P)</label>
                        <input type="text" required value={playerForm.secondary_skills} onChange={e => setPlayerForm({...playerForm, secondary_skills: e.target.value})} className={styles.inputField} placeholder="S, P" />
                      </div>
                    </div>

                    {/* GESTIONE SKILLS CON AUTOCOMPLETE E VALIDAZIONE */}
                    <div className={`${styles.inputGroup} ${styles.blockGap} ${styles.autocomplete}`}>
                      <label className={styles.label}>STARTING SKILLS</label>

                      {playerForm.skills.length > 0 && (
                          <div className={styles.chipList}>
                            {playerForm.skills.map(s => (
                                <span key={s.id} className={styles.skillChip}>
                                  {formatSkillName(s.name)}
                                  <button type="button" onClick={() => removeSkillFromPlayer(s)} className={styles.chipRemove} aria-label={`Remove ${formatSkillName(s.name)}`}><X size={16}/></button>
                                </span>
                            ))}
                          </div>
                      )}

                      <input
                          type="text"
                          value={skillInput}
                          onChange={e => handleSkillInputChange(e.target.value)}
                          onKeyDown={handleSkillKeyDown}
                          className={styles.inputField}
                          placeholder="Type skill and press Enter..."
                          autoComplete="off"
                      />

                      {/* Dropdown ingrandito (maxHeight 350px) */}
                      {skillSuggestions.length > 0 && (
                          <ul className={styles.suggestions}>
                            {skillSuggestions.map(skill => (
                                <li
                                    key={skill.id}
                                    onClick={() => addSkillToPlayer(skill)}
                                    className={styles.suggestion}
                                >
                                  {formatSkillName(skill.name)} <span className={styles.suggestionType}>({skill.type})</span>
                                </li>
                            ))}
                          </ul>
                      )}
                    </div>

                    <div className={styles.gridStats}>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thMA}</label>
                        <input type="number" required value={playerForm.ma} onChange={e => setPlayerForm({...playerForm, ma: Number(e.target.value)})} className={styles.statInput} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thST}</label>
                        <input type="number" required value={playerForm.st} onChange={e => setPlayerForm({...playerForm, st: Number(e.target.value)})} className={styles.statInput} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thAG}</label>
                        <input type="text" required value={playerForm.ag} onChange={e => setPlayerForm({...playerForm, ag: e.target.value})} className={styles.statInput} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thPA}</label>
                        <input type="text" required value={playerForm.pa} onChange={e => setPlayerForm({...playerForm, pa: e.target.value})} className={styles.statInput} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thAV}</label>
                        <input type="text" required value={playerForm.av} onChange={e => setPlayerForm({...playerForm, av: e.target.value})} className={styles.statInput} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thSPP}</label>
                        <input type="number" required value={playerForm.spp} onChange={e => setPlayerForm({...playerForm, spp: Number(e.target.value)})} className={styles.statInput} />
                      </div>
                    </div>

                    <div className={styles.formActions}>
                      <button type="button" className="btn" onClick={() => setShowPlayerForm(false)}><span>CANCEL</span></button>
                      <button type="submit" className="btn btn-primary" disabled={isSubmitting}><span>SIGN CONTRACT</span></button>
                    </div>
                  </form>
                </div>
            )}

            {/* TABELLA ROSTER (Rulebook Team Roster) */}
            {team.players.length === 0 ? (
                <div className={`chamfer ${styles.empty}`}>
                  <p className={styles.emptyTitle}>NO PLAYERS HIRED YET</p>
                </div>
            ) : (
                <div className={`offset-frame ${styles.rosterFrame}`}>
                  <div className={`table-container chamfer ${styles.rosterTable}`}>
                    <div className={styles.tableStrip} aria-hidden="true">
                      <span><i className={styles.microSquares} />{team.name}</span>
                      <span className={styles.tableStripMeta}>{`${team.race} // ${activePlayers.length} / 16`}</span>
                    </div>
                    <table className={`data-table ${styles.dataTable}`}>
                      <thead>
                      <tr>
                        <th className="num">N°</th>
                        <th>{t.teamDetail.thName}</th>
                        <th>{t.teamDetail.thRole}</th>
                        <th className="num">MA</th>
                        <th className="num">ST</th>
                        <th className="num">AG</th>
                        <th className="num">PA</th>
                        <th className="num">AV</th>
                        <th className="num">SPP</th>
                        <th className={styles.skillsCol}>{t.teamDetail.thSkills}</th>
                        <th className={styles.right}>{t.teamDetail.thValue}</th>
                        <th className="num">STATUS</th>
                        {isAdmin && <th className="num">ACT</th>}
                      </tr>
                      </thead>
                      <tbody>
                      {sortedPlayers.map(player => {

                        // RIGA IN MODALITÀ MODIFICA
                        if (editingPlayerId === player.id) {
                          return (
                              <tr key={player.id} className={styles.editRow}>
                                <td>
                                  <input type="number" value={editPlayerForm.jersey_number} onChange={e => setEditPlayerForm({...editPlayerForm, jersey_number: e.target.value})} className={styles.editInput} />
                                </td>
                                <td>
                                  <input type="text" value={editPlayerForm.name} onChange={e => setEditPlayerForm({...editPlayerForm, name: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                                </td>
                                <td>
                                  <input type="text" value={editPlayerForm.role} onChange={e => setEditPlayerForm({...editPlayerForm, role: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                                </td>
                                <td><input type="number" value={editPlayerForm.ma} onChange={e => setEditPlayerForm({...editPlayerForm, ma: Number(e.target.value)})} className={styles.editInput} /></td>
                                <td><input type="number" value={editPlayerForm.st} onChange={e => setEditPlayerForm({...editPlayerForm, st: Number(e.target.value)})} className={styles.editInput} /></td>
                                <td><input type="text" value={editPlayerForm.ag} onChange={e => setEditPlayerForm({...editPlayerForm, ag: e.target.value})} className={styles.editInput} /></td>
                                <td><input type="text" value={editPlayerForm.pa} onChange={e => setEditPlayerForm({...editPlayerForm, pa: e.target.value})} className={styles.editInput} /></td>
                                <td><input type="text" value={editPlayerForm.av} onChange={e => setEditPlayerForm({...editPlayerForm, av: e.target.value})} className={styles.editInput} /></td>

                                {/* SPP BLOCCATI */}
                                <td className={`num ${styles.statCell} ${styles.locked}`}>{player.spp}</td>

                                {/* SKILLS BLOCCATE */}
                                <td className={`${styles.skillsCol} ${styles.locked}`}>
                                  {player.skills && player.skills.map(s => formatSkillName(s.name)).join(', ')}
                                </td>

                                <td>
                                  <input type="number" value={editPlayerForm.value} onChange={e => setEditPlayerForm({...editPlayerForm, value: Number(e.target.value)})} className={`${styles.editInput} ${styles.editInputValue}`} />
                                </td>

                                {/* TOGGLE MNG E DEAD */}
                                <td>
                                  <div className={styles.toggles}>
                                    <label className={styles.toggle}>
                                      <input type="checkbox" checked={editPlayerForm.mng} onChange={e => setEditPlayerForm({...editPlayerForm, mng: e.target.checked})} className={styles.checkbox} /> MNG
                                    </label>
                                    <label className={styles.toggle}>
                                      <input type="checkbox" checked={editPlayerForm.dead} onChange={e => setEditPlayerForm({...editPlayerForm, dead: e.target.checked})} className={styles.checkbox} /> RIP
                                    </label>
                                  </div>
                                </td>

                                <td>
                                  <div className={styles.rowActions}>
                                    <button onClick={() => handleSavePlayerEdit(player.id)} className={`${styles.iconBtn} ${styles.iconSave}`} title="Save" aria-label="Save"><Save size={20} /></button>
                                    <button onClick={() => setEditingPlayerId(null)} className={`${styles.iconBtn} ${styles.iconDanger}`} title="Cancel" aria-label="Cancel"><X size={20} /></button>
                                  </div>
                                </td>
                              </tr>
                          );
                        }

                        // RIGA STANDARD
                        const isDead = player.dead === 1 || player.dead === true;
                        const isMNG = player.mng === 1 || player.mng === true;

                        const currentAdvancements = Math.min(player.advancements || 0, 5);
                        const costOfNextLevel = ADVANCEMENT_TIERS[currentAdvancements].randomPrimary;
                        const canLevelUp = !isDead && (player.advancements || 0) < MAX_ADVANCEMENTS && (player.spp >= costOfNextLevel);

                        const totalSkills = player.skills?.length || 0;
                        const earnedCount = player.advancements || 0;
                        const startingCount = Math.max(0, totalSkills - earnedCount);

                        return (
                            <tr key={player.id} className={isDead ? styles.deadRow : undefined}>

                              {/* NUMERO DI MAGLIA con filetto nel colore squadra */}
                              <td className="num">
                                <span className={styles.jersey}>{player.jersey_number || '-'}</span>
                              </td>

                              <td className={styles.playerName}>
                                {player.name}
                              </td>

                              {/* RUOLO CON STELLE AVANZAMENTO */}
                              <td className={styles.playerRole}>
                                {player.role}
                                {player.advancements > 0 && (
                                    <span className={styles.stars} aria-label={`${player.advancements} advancements`}>
                                      {'★'.repeat(player.advancements)}
                                    </span>
                                )}
                              </td>

                              <td className={`num ${styles.statCell}`}>{player.ma ?? 6}</td>
                              <td className={`num ${styles.statCell}`}>{player.st ?? 3}</td>
                              <td className={`num ${styles.statCell}`}>{player.ag ?? '3+'}</td>
                              <td className={`num ${styles.statCell}`}>{player.pa ?? '4+'}</td>
                              <td className={`num ${styles.statCell}`}>{player.av ?? '8+'}</td>
                              <td className={`num ${styles.statCell} ${styles.sppCell}`}>{player.spp ?? 0}</td>

                              {/* VISUALIZZAZIONE SKILLS CON LINK ALLA PAGINA REGOLAMENTO */}
                              <td className={styles.skillsCol}>
                                {player.skills && Array.isArray(player.skills) && player.skills.map((s, i) => {
                                  const isEarned = i >= startingCount;

                                  return (
                                      <span key={s.id}>
                                        {i > 0 && ', '}
                                        <button
                                            type="button"
                                            onClick={() => router.push(`/skills?expandedId=${s.id}`)}
                                            className={`${styles.skillLink} ${isEarned ? styles.skillEarned : ''}`}
                                            title="Vedi dettagli abilità"
                                        >
                                          {formatSkillName(s.name)}
                                        </button>
                                      </span>
                                  );
                                })}
                              </td>

                              <td className={`${styles.right} ${styles.valueCell}`}>{player.value.toLocaleString()}</td>

                              {/* VISUALIZZAZIONE STATO */}
                              <td className="num">
                                {isDead ? (
                                    <span className={`tag tag-red ${styles.statusTag}`}><Skull size={14} aria-hidden="true" /> RIP</span>
                                ) : isMNG ? (
                                    <span className={`tag tag-navy ${styles.statusTag}`}>MNG</span>
                                ) : (
                                    <span className={styles.statusOk} aria-label="Active" />
                                )}
                              </td>

                              {isAdmin && (
                              <td>
                                <div className={styles.rowActions}>
                                  {canLevelUp && (
                                      <button onClick={() => setLevelUpPlayer(player)} className={`${styles.iconBtn} ${styles.iconLevel}`} title="SPP Advancement" aria-label="SPP Advancement"><ArrowUpCircle size={22} /></button>
                                  )}
                                  <button onClick={() => startEditPlayer(player)} className={styles.iconBtn} title="Edit" aria-label="Edit"><Edit2 size={20} /></button>
                                  <button onClick={() => handleDeletePlayer(player.id, player.name)} className={`${styles.iconBtn} ${styles.iconDanger}`} title="Fire (Permanent Delete)" aria-label="Fire"><Trash2 size={20} /></button>
                                </div>
                              </td>
                              )}
                            </tr>
                        );
                      })}
                      </tbody>
                      <tfoot>
                      <tr>
                        <td colSpan={10} className={styles.right}>{t.teamDetail.teamValue}</td>
                        <td className={styles.right}>{totalValue.toLocaleString()}</td>
                        <td colSpan={isAdmin ? 2 : 1} />
                      </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
            )}
          </div>
        </section>
      </div>
  );
}
