'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Trash2, Plus, Edit2, Save, X, Skull, ArrowUpCircle, Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './TeamDetails.module.css';

const ADVANCEMENT_TIERS = [
  { name: 'Experienced (1st)', randomPrimary: 3, choosePrimary: 6, chooseSecondary: 10, stat: 14 },
  { name: 'Veteran (2nd)', randomPrimary: 4, choosePrimary: 8, chooseSecondary: 12, stat: 16 },
  { name: 'Emerging Star (3rd)', randomPrimary: 6, choosePrimary: 12, chooseSecondary: 16, stat: 20 },
  { name: 'Star (4th)', randomPrimary: 8, choosePrimary: 16, chooseSecondary: 20, stat: 24 },
  { name: 'Superstar (5th)', randomPrimary: 10, choosePrimary: 20, chooseSecondary: 24, stat: 28 },
  { name: 'Legend (6th)', randomPrimary: 15, choosePrimary: 30, chooseSecondary: 34, stat: 38 },
];

const SKILL_CATEGORIES_MAP: Record<string, string> = {
  'G': 'General',
  'A': 'Agility',
  'S': 'Strength',
  'P': 'Passing',
  'M': 'Mutation'
};

export default function TeamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useLanguage();

  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // STATO GLOBALE DELLE SKILL (Dizionario)
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);

  // Team edit form
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', primary_color: '', secondary_color: '', logo_url: '',
    rerolls: 0, reroll_cost: 50000, cheerleaders: 0, assistant_coaches: 0, fan_factor: 0, apothecary: false,
    treasury: 0, bank: 0
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Player forms
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Level Up State
  const [levelUpPlayer, setLevelUpPlayer] = useState<any>(null);
  const [levelUpChoice, setLevelUpChoice] = useState<string>('');
  const [selectedAdvancement, setSelectedAdvancement] = useState<any>(null);

  // NUOVO STATO: Modale Celebrazione Skill Random
  const [celebrationSkill, setCelebrationSkill] = useState<any>(null);

  // Autocomplete State (Solo per la Creazione)
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<any[]>([]);

  const [editPlayerForm, setEditPlayerForm] = useState({
    jersey_number: '', name: '', role: '', value: 0,
    primary_skills: '', secondary_skills: '', advancements: 0,
    skills: [] as any[],
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0,
    mng: false, dead: false
  });

  const [playerForm, setPlayerForm] = useState({
    jersey_number: '', name: '', role: 'Lineman', value: 50000, skills: [] as any[],
    primary_skills: 'G', secondary_skills: 'A', // Default per non lasciarlo vuoto
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0
  });

  const fetchTeamAndSkills = async () => {
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
  };

  useEffect(() => {
    fetchTeamAndSkills();
  }, [id]);

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
        !playerForm.skills.some((s: any) => s.id === skill.id)
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
      if (playerForm.skills.some((s: any) => s.id === exactMatch.id)) return alert(`Già posseduta.`);

      addSkillToPlayer(exactMatch);
    }
  };

  const addSkillToPlayer = (skill: any) => {
    if (!playerForm.skills.some((s: any) => s.id === skill.id)) {
      setPlayerForm({ ...playerForm, skills: [...playerForm.skills, skill] });
    }
    setSkillInput('');
    setSkillSuggestions([]);
  };

  const removeSkillFromPlayer = (skill: any) => {
    if (!confirm(`Rimuovere "${formatSkillName(skill.name)}"?`)) return;
    setPlayerForm({ ...playerForm, skills: playerForm.skills.filter((s: any) => s.id !== skill.id) });
  };
  // -----------------------------------

  // --- FUNZIONE PER FILTRARE LE SKILL DEL LEVEL UP ---
  const getFilteredSkillsForLevelUp = (type: 'primary' | 'secondary') => {
    if (!levelUpPlayer) return [];

    const allowedLettersString = type === 'primary' ? levelUpPlayer.primary_skills : levelUpPlayer.secondary_skills;
    if (!allowedLettersString || allowedLettersString.trim() === '') return []; // Ritorna vuoto se NULL

    const allowedLetters = allowedLettersString.split(',').map((s: string) => s.trim().toUpperCase());
    const allowedCategories = allowedLetters.map((l: string) => SKILL_CATEGORIES_MAP[l] || l);

    return availableSkills.filter(skill => {
      const alreadyHas = levelUpPlayer.skills.some((ps: any) => ps.id === skill.id);
      const isAllowedCategory = allowedCategories.some((cat: string) => skill.type?.toLowerCase().includes(cat.toLowerCase()));

      return !alreadyHas && isAllowedCategory;
    });
  };

  // --- NUOVA LOGICA: TENTATIVO CASUALE (Salva e Mostra Animazione Immediata) ---
  const handleRandomRoll = async () => {
    const currentTier = Math.min(levelUpPlayer.advancements || 0, 5);
    const costs = ADVANCEMENT_TIERS[currentTier];

    if (levelUpPlayer.spp < costs.randomPrimary) return alert('SPP Insufficienti!');

    const validSkills = getFilteredSkillsForLevelUp('primary');
    if (validSkills.length === 0) return alert("Nessuna skill primaria disponibile!");

    // Genera la skill randomicamente
    const randomSkill = validSkills[Math.floor(Math.random() * validSkills.length)];
    const sppCost = costs.randomPrimary;
    const valueIncrease = 20000;
    const newSkillIds = [...levelUpPlayer.skills.map((s:any) => s.id), randomSkill.id];

    try {
      // Effettua il salvataggio immediatamente al DB
      const res = await fetch(`/api/players/${levelUpPlayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: levelUpPlayer.value + valueIncrease,
          spp: levelUpPlayer.spp - sppCost,
          advancements: (levelUpPlayer.advancements || 0) + 1,
          skills: newSkillIds,
          ma: levelUpPlayer.ma, st: levelUpPlayer.st, ag: levelUpPlayer.ag, pa: levelUpPlayer.pa, av: levelUpPlayer.av,
          mng: levelUpPlayer.mng, dead: levelUpPlayer.dead
        })
      });

      if (res.ok) {
        // Chiudi la modale di Level Up e apri quella di Celebrazione!
        setLevelUpPlayer(null);
        setLevelUpChoice('');
        setSelectedAdvancement(null);

        setCelebrationSkill(randomSkill);
        fetchTeamAndSkills();
      } else {
        alert('Errore durante l\'avanzamento');
      }
    } catch (e) {
      alert('Errore di connessione');
    }
  };

  // --- LOGICA LEVEL UP STANDARD (Scelta Manuale) ---
  const handleLevelUpSave = async () => {
    if (!levelUpChoice) return alert('Seleziona un potenziamento!');

    const currentTier = Math.min(levelUpPlayer.advancements || 0, 5);
    const costs = ADVANCEMENT_TIERS[currentTier];

    let sppCost = 0;
    let valueIncrease = 0;
    let newSkillIds = levelUpPlayer.skills.map((s:any) => s.id);
    let updatedStats = { ma: levelUpPlayer.ma, st: levelUpPlayer.st, ag: levelUpPlayer.ag, pa: levelUpPlayer.pa, av: levelUpPlayer.av };

    if (levelUpChoice === 'choosePrimary') {
      sppCost = costs.choosePrimary; valueIncrease = 20000;
      if(!selectedAdvancement) return alert('Seleziona una skill!');
      newSkillIds.push(selectedAdvancement.id);
    } else if (levelUpChoice === 'chooseSecondary') {
      sppCost = costs.chooseSecondary; valueIncrease = 40000;
      if(!selectedAdvancement) return alert('Seleziona una skill!');
      newSkillIds.push(selectedAdvancement.id);
    } else if (levelUpChoice.startsWith('stat_')) {
      sppCost = costs.stat;
      const stat = levelUpChoice.split('_')[1];
      if (stat === 'ma') { valueIncrease = 20000; updatedStats.ma += 1; }
      if (stat === 'pa') { valueIncrease = 20000; }
      if (stat === 'ag') { valueIncrease = 30000; }
      if (stat === 'av') { valueIncrease = 10000; }
      if (stat === 'st') { valueIncrease = 60000; updatedStats.st += 1; }
    }

    if (levelUpPlayer.spp < sppCost) return alert('SPP Insufficienti!');

    try {
      const res = await fetch(`/api/players/${levelUpPlayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: levelUpPlayer.value + valueIncrease,
          spp: levelUpPlayer.spp - sppCost,
          advancements: (levelUpPlayer.advancements || 0) + 1,
          skills: newSkillIds,
          ...updatedStats
        })
      });

      if (res.ok) {
        setLevelUpPlayer(null); setSelectedAdvancement(null); setLevelUpChoice('');
        fetchTeamAndSkills();
      }
    } catch (e) { alert('Errore durante l\'avanzamento'); }
  };
  // -----------------------

  const handleDeleteTeam = async () => {
    if (!confirm(t.teamDetail.confirmDisband.replace('{teamName}', team.name))) return;
    try {
      await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      router.push('/teams');
    } catch (e) { alert('Failed to delete team'); }
  };

  const openEditTeam = () => {
    setEditForm({
      name: team.name, primary_color: team.primary_color, secondary_color: team.secondary_color, logo_url: team.logo_url || '',
      rerolls: team.rerolls || 0, reroll_cost: team.reroll_cost || 50000, cheerleaders: team.cheerleaders || 0, assistant_coaches: team.assistant_coaches || 0,
      fan_factor: team.fan_factor || 0, apothecary: team.apothecary === 1 || team.apothecary === true, treasury: team.treasury || 0, bank: team.bank || 0
    });
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

      if (logoFile) submitData.append('logo_file', logoFile);
      else if (editForm.logo_url) submitData.append('logo_url', editForm.logo_url);
      else submitData.append('logo_url', '');

      const res = await fetch(`/api/teams/${id}`, { method: 'PUT', body: submitData });
      if (res.ok) { setShowEditTeam(false); fetchTeamAndSkills(); }
      else alert('Failed to update team');
    } catch (err) { alert('Error updating team'); }
    finally { setIsEditingTeam(false); }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const skillIds = playerForm.skills.map((s: any) => s.id);

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
    } catch (e) { alert('Error hiring player'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!confirm(t.teamDetail.confirmFire.replace('{playerName}', name))) return;
    try { await fetch(`/api/players/${playerId}`, { method: 'DELETE' }); fetchTeamAndSkills(); }
    catch (e) { alert('Failed to fire player'); }
  };

  const startEditPlayer = (player: any) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      jersey_number: player.jersey_number || '', name: player.name, role: player.role, value: player.value,
      primary_skills: player.primary_skills || '', secondary_skills: player.secondary_skills || '', advancements: player.advancements || 0,
      skills: player.skills || [], // Le skills originali (non verranno modificate dalla UI)
      ma: player.ma ?? 6, st: player.st ?? 3, ag: player.ag ?? '3+', pa: player.pa ?? '4+', av: player.av ?? '8+',
      spp: player.spp ?? 0, mng: player.mng === 1 || player.mng === true, dead: player.dead === 1 || player.dead === true
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
    } catch (e) { alert('Error updating player'); }
  };

  if (loading || !team) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>Loading locker room...</div>;

  const activePlayers = team.players.filter((p: any) => p.dead !== 1 && p.dead !== true);

  const staffValue =
      ((team.rerolls || 0) * (team.reroll_cost || 50000)) +
      ((team.cheerleaders || 0) * 10000) +
      ((team.assistant_coaches || 0) * 10000) +
      ((team.fan_factor || 0) * 10000) +
      (team.apothecary ? 50000 : 0);

  const totalValue = activePlayers.reduce((sum: number, p: any) => sum + p.value, 0) + staffValue;

  const sortedPlayers = [...team.players].sort((a, b) => {
    const aDead = a.dead === 1 || a.dead === true;
    const bDead = b.dead === 1 || b.dead === true;
    if (aDead && !bDead) return 1;
    if (!aDead && bDead) return -1;
    return (a.jersey_number || 99) - (b.jersey_number || 99);
  });

  return (
      <div>
        <svg style={{ width: 0, height: 0, position: 'absolute' }}>
          <filter id="rough-edges">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        {/* MODALE DI CELEBRAZIONE SKILL CASUALE */}
        {celebrationSkill && (
            <div style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
              flexDirection: 'column'
            }}>
              <Dices size={80} color="var(--color-blood-bright)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontFamily: 'var(--font-impact)', fontSize: '4rem', color: 'var(--color-gold)', margin: 0, textShadow: '4px 4px 0px #000', textAlign: 'center', lineHeight: 1 }}>
                NUFFLE HAS SPOKEN!
              </h2>
              <p style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', color: '#fff', marginBottom: '2rem', textAlign: 'center' }}>
                The dice rolled in your favor...
              </p>

              <div style={{ background: 'var(--color-ink)', padding: '2rem 4rem', border: '6px solid var(--color-blood-bright)', transform: 'rotate(-2deg)', boxShadow: '10px 10px 0px rgba(0,0,0,0.5)', marginBottom: '3rem', textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--font-impact)', fontSize: '3rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '3px' }}>
                  {formatSkillName(celebrationSkill.name)}
                </span>
                <br/>
                <span style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1rem', color: '#888', fontWeight: 'bold' }}>
                  ({celebrationSkill.type})
                </span>
              </div>

              <button className="btn btn-primary" style={{ fontSize: '1.5rem', padding: '1rem 3rem' }} onClick={() => setCelebrationSkill(null)}>
                ACCEPT GLORY
              </button>
            </div>
        )}

        {/* TEAM IDENTITY BANNER */}
        <div className={styles.teamIdentityBanner}>
          <div className={styles.logoSection} style={{ borderLeftColor: team.primary_color }}>
            {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
            ) : (
                <ShieldAlert size={100} color={team.primary_color} className={styles.teamLogo} />
            )}
          </div>

          <div className={styles.infoSection}>
            <div className={styles.actionGroup}>
              <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={openEditTeam}><Edit2 size={18}/> EDIT</button>
              <button className={`${styles.actionBtn} ${styles.disbandBtn}`} onClick={handleDeleteTeam}><Trash2 size={18}/> DISBAND</button>
            </div>
            <h1 className={styles.teamName} style={{ textShadow: `4px 4px 0 ${team.secondary_color}` }}>{team.name}</h1>
            <div className={styles.teamRace}>{team.race} &bull; TV: {totalValue.toLocaleString()}</div>
            <div className={styles.managementBadges}>
              <span className={styles.badge}>Rerolls: {team.rerolls || 0}</span>
              <span className={styles.badge}>Cheerleaders: {team.cheerleaders || 0}</span>
              <span className={styles.badge}>Coaches: {team.assistant_coaches || 0}</span>
              <span className={styles.badge}>Fans: {team.fan_factor || 0}</span>
              <span className={styles.badge}>Apothecary: {team.apothecary ? 'Yes' : 'No'}</span>
              <span className={`${styles.badge} ${styles.badgeGold}`}>Treasury: {(team.treasury || 0).toLocaleString()} GP</span>
              <span className={`${styles.badge} ${styles.badgeGold}`}>Bank: {(team.bank || 0).toLocaleString()} GP</span>
            </div>
          </div>
        </div>

        {/* MODALITÀ LEVEL UP (POPUP CENTRALE CON BOTTONI DISABILITABILI) */}
        {levelUpPlayer && (
            <div style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
            }}>
              <div className={styles.formCard} style={{ border: '4px solid var(--color-gold)', backgroundColor: '#fff', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', transform: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 className={styles.formTitle} style={{ color: 'var(--color-gold)', margin: 0, border: 'none' }}>
                    SPP ADVANCEMENT: {levelUpPlayer.name}
                  </h3>
                  <button onClick={() => { setLevelUpPlayer(null); setLevelUpChoice(''); setSelectedAdvancement(null); }} className="btn"><X size={24}/></button>
                </div>

                <div style={{ background: '#111', color: '#fff', padding: '1rem', fontFamily: 'var(--font-typewriter)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>CURRENT SPP: <strong style={{ color: 'var(--color-gold)', fontSize: '1.5rem' }}>{levelUpPlayer.spp}</strong></span>
                  <span>ADVANCEMENTS: <strong>{levelUpPlayer.advancements || 0} / 6</strong></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                  {/* Calcolo disponibilità pulsanti in base al database */}
                  <button
                      className="btn"
                      disabled={!levelUpPlayer.primary_skills}
                      style={{
                        borderColor: levelUpChoice === 'randomPrimary' ? 'var(--color-blood-bright)' : '#ccc',
                        opacity: levelUpPlayer.primary_skills ? 1 : 0.4
                      }}
                      onClick={handleRandomRoll}
                  >
                    Random Primary ({ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)].randomPrimary} SPP)
                  </button>
                  <button
                      className="btn"
                      disabled={!levelUpPlayer.primary_skills}
                      style={{
                        borderColor: levelUpChoice === 'choosePrimary' ? 'var(--color-blood-bright)' : '#ccc',
                        opacity: levelUpPlayer.primary_skills ? 1 : 0.4
                      }}
                      onClick={() => setLevelUpChoice('choosePrimary')}
                  >
                    Choose Primary ({ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)].choosePrimary} SPP)
                  </button>
                  <button
                      className="btn"
                      disabled={!levelUpPlayer.secondary_skills}
                      style={{
                        borderColor: levelUpChoice === 'chooseSecondary' ? 'var(--color-blood-bright)' : '#ccc',
                        opacity: levelUpPlayer.secondary_skills ? 1 : 0.4
                      }}
                      onClick={() => setLevelUpChoice('chooseSecondary')}
                  >
                    Choose Secondary ({ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)].chooseSecondary} SPP)
                  </button>
                  <button
                      className="btn"
                      style={{ borderColor: levelUpChoice.startsWith('stat_') ? 'var(--color-blood-bright)' : '#ccc' }}
                      onClick={() => setLevelUpChoice('stat_ma')}
                  >
                    Characteristic ({ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)].stat} SPP)
                  </button>
                </div>

                {(levelUpChoice === 'choosePrimary' || levelUpChoice === 'chooseSecondary') && (
                    <select onChange={(e) => setSelectedAdvancement(availableSkills.find(s => s.id === e.target.value))} className={styles.inputField} style={{ marginBottom: '2rem' }}>
                      <option value="">Select a skill...</option>
                      {getFilteredSkillsForLevelUp(levelUpChoice === 'choosePrimary' ? 'primary' : 'secondary').map(s => (
                          <option key={s.id} value={s.id}>{formatSkillName(s.name)} ({s.type})</option>
                      ))}
                    </select>
                )}

                {levelUpChoice.startsWith('stat_') && (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => setLevelUpChoice('stat_ma')} style={{ borderColor: levelUpChoice === 'stat_ma' ? 'var(--color-blood-bright)' : '#ccc' }}>+MA</button>
                      <button className="btn" onClick={() => setLevelUpChoice('stat_st')} style={{ borderColor: levelUpChoice === 'stat_st' ? 'var(--color-blood-bright)' : '#ccc' }}>+ST</button>
                      <button className="btn" onClick={() => setLevelUpChoice('stat_ag')} style={{ borderColor: levelUpChoice === 'stat_ag' ? 'var(--color-blood-bright)' : '#ccc' }}>+AG</button>
                      <button className="btn" onClick={() => setLevelUpChoice('stat_pa')} style={{ borderColor: levelUpChoice === 'stat_pa' ? 'var(--color-blood-bright)' : '#ccc' }}>+PA</button>
                      <button className="btn" onClick={() => setLevelUpChoice('stat_av')} style={{ borderColor: levelUpChoice === 'stat_av' ? 'var(--color-blood-bright)' : '#ccc' }}>+AV</button>
                    </div>
                )}

                <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={handleLevelUpSave}
                    disabled={levelUpChoice === '' || levelUpChoice === 'randomPrimary'} // Non usare per il random
                >
                  CONFIRM MANUAL ADVANCEMENT
                </button>
              </div>
            </div>
        )}

        {/* EDIT TEAM FORM */}
        {showEditTeam && (
            <div className={styles.formCard}>
              <h3 className={styles.formTitle}>UPDATE TEAM DOSSIER</h3>
              <form onSubmit={handleEditSubmit}>
                <div className={styles.grid3Col}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.teamDetail.name}</label>
                    <input type="text" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className={styles.inputField} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.draft.primaryColor}</label>
                    <input type="color" value={editForm.primary_color} onChange={e => setEditForm({...editForm, primary_color: e.target.value})} style={{ width: '100%', height: '50px', border: '3px solid var(--color-ink)', cursor: 'pointer' }} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.draft.secondaryColor}</label>
                    <input type="color" value={editForm.secondary_color} onChange={e => setEditForm({...editForm, secondary_color: e.target.value})} style={{ width: '100%', height: '50px', border: '3px solid var(--color-ink)', cursor: 'pointer' }} />
                  </div>
                </div>

                <div className={styles.gridStats}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.rerolls}</label>
                    <input type="number" min="0" max="8" value={editForm.rerolls} onChange={e => setEditForm({...editForm, rerolls: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>R. COST</label>
                    <input type="number" min="0" step="10000" value={editForm.reroll_cost} onChange={e => setEditForm({...editForm, reroll_cost: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.cheerleaders}</label>
                    <input type="number" min="0" max="16" value={editForm.cheerleaders} onChange={e => setEditForm({...editForm, cheerleaders: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>COACHES</label>
                    <input type="number" min="0" max="16" value={editForm.assistant_coaches} onChange={e => setEditForm({...editForm, assistant_coaches: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.fanFactor}</label>
                    <input type="number" min="0" max="18" value={editForm.fan_factor} onChange={e => setEditForm({...editForm, fan_factor: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup} style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-impact)', fontSize: '1.2rem' }}>
                      <span>APOTHECARY</span>
                      <input type="checkbox" checked={editForm.apothecary} onChange={e => setEditForm({...editForm, apothecary: e.target.checked})} style={{ width: '25px', height: '25px', accentColor: 'var(--color-blood-bright)' }} />
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

                <div className={styles.inputGroup} style={{ marginBottom: '2rem' }}>
                  <label className={styles.label}>{t.draft.logoUrl}</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ fontFamily: 'var(--font-typewriter)', padding: '0.5rem', border: '3px solid var(--color-ink)' }} />
                      <input type="url" value={editForm.logo_url} onChange={(e) => { setEditForm({...editForm, logo_url: e.target.value}); setLogoFile(null); setLogoPreview(null); }} className={styles.inputField} placeholder="https://..." />
                    </div>
                    {(logoPreview || editForm.logo_url) && (
                        <div style={{ width: '80px', height: '80px', border: '3px solid var(--color-ink)', flexShrink: 0, padding: '5px', background: '#fff' }}>
                          <img src={logoPreview || editForm.logo_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setShowEditTeam(false)}>CANCEL</button>
                  <button type="submit" className="btn btn-primary" disabled={isEditingTeam}>
                    {isEditingTeam ? 'SAVING...' : 'SAVE DOSSIER'}
                  </button>
                </div>
              </form>
            </div>
        )}

        {/* 3. ROSTER DELLA SQUADRA */}
        <div className={styles.rosterHeader}>
          <h2 className={styles.rosterTitle}>ROSTER ({activePlayers.length} / 16)</h2>
          {!showPlayerForm && activePlayers.length < 16 && (
              <button className="btn btn-primary" onClick={() => setShowPlayerForm(true)}>
                <Plus size={20} style={{ marginRight: '0.5rem' }}/> {t.teamDetail.hirePlayer}
              </button>
          )}
        </div>

        {/* ADD PLAYER FORM */}
        {showPlayerForm && (
            <div className={styles.formCard}>
              <h3 className={styles.formTitle}>NEW RECRUIT CONTRACT</h3>
              <form onSubmit={handleAddPlayer}>
                <div className={styles.grid4Col} style={{ gridTemplateColumns: '80px 2fr 1fr 1fr' }}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>N°</label>
                    <input type="number" value={playerForm.jersey_number} onChange={e => setPlayerForm({...playerForm, jersey_number: e.target.value})} className={styles.inputField} style={{ textAlign: 'center' }} placeholder="##" />
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
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
                <div className={styles.inputGroup} style={{ marginBottom: '2rem', position: 'relative' }}>
                  <label className={styles.label}>STARTING SKILLS</label>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {playerForm.skills.map((s: any) => (
                        <span key={s.id} style={{ background: 'var(--color-ink)', color: '#fff', padding: '0.3rem 0.6rem', fontFamily: 'var(--font-impact)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {formatSkillName(s.name)}
                          <button type="button" onClick={() => removeSkillFromPlayer(s)} style={{ background: 'none', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer', padding: 0 }}><X size={14}/></button>
                      </span>
                    ))}
                  </div>

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
                      <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '2px solid var(--color-ink)', zIndex: 10, listStyle: 'none', padding: 0, margin: 0, maxHeight: '350px', overflowY: 'auto', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
                        {skillSuggestions.map(skill => (
                            <li
                                key={skill.id}
                                onClick={() => addSkillToPlayer(skill)}
                                style={{ padding: '0.8rem', borderBottom: '1px solid #ddd', cursor: 'pointer', fontFamily: 'var(--font-typewriter)', fontWeight: 'bold' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(229, 9, 20, 0.1)')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              {formatSkillName(skill.name)} <span style={{ color: '#888', fontSize: '0.8rem' }}>({skill.type})</span>
                            </li>
                        ))}
                      </ul>
                  )}
                </div>

                <div className={styles.gridStats}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thMA}</label>
                    <input type="number" required value={playerForm.ma} onChange={e => setPlayerForm({...playerForm, ma: Number(e.target.value)})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thST}</label>
                    <input type="number" required value={playerForm.st} onChange={e => setPlayerForm({...playerForm, st: Number(e.target.value)})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thAG}</label>
                    <input type="text" required value={playerForm.ag} onChange={e => setPlayerForm({...playerForm, ag: e.target.value})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thPA}</label>
                    <input type="text" required value={playerForm.pa} onChange={e => setPlayerForm({...playerForm, pa: e.target.value})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thAV}</label>
                    <input type="text" required value={playerForm.av} onChange={e => setPlayerForm({...playerForm, av: e.target.value})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} style={{textAlign: 'center'}}>{t.teamDetail.thSPP}</label>
                    <input type="number" required value={playerForm.spp} onChange={e => setPlayerForm({...playerForm, spp: Number(e.target.value)})} className={styles.statInput} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setShowPlayerForm(false)}>CANCEL</button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>SIGN CONTRACT</button>
                </div>
              </form>
            </div>
        )}

        {/* TABELLA ROSTER CON COLONNE LARGHE E VISUAL TWEAKS */}
        {team.players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', border: '4px dashed var(--color-ink)', background: 'var(--color-paper)' }}>
              <p style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: '#555' }}>NO PLAYERS HIRED YET</p>
            </div>
        ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                <tr>
                  <th style={{ width: '60px' }}>N°</th>
                  <th className={styles.leftAlign}>{t.teamDetail.thName}</th>
                  <th className={styles.leftAlign}>{t.teamDetail.thRole}</th>
                  <th style={{ width: '65px' }}>MA</th>
                  <th style={{ width: '65px' }}>ST</th>
                  <th style={{ width: '65px' }}>AG</th>
                  <th style={{ width: '65px' }}>PA</th>
                  <th style={{ width: '65px' }}>AV</th>
                  <th style={{ width: '75px' }}>SPP</th>
                  <th className={styles.leftAlign} style={{ minWidth: '200px' }}>{t.teamDetail.thSkills}</th>
                  <th style={{ width: '120px' }}>{t.teamDetail.thValue}</th>
                  <th style={{ width: '90px' }}>STATUS</th>
                  <th>ACT</th>
                </tr>
                </thead>
                <tbody>
                {sortedPlayers.map((player: any) => {

                  // RIGA IN MODALITÀ MODIFICA
                  if (editingPlayerId === player.id) {
                    return (
                        <tr key={player.id} className={styles.editRow}>
                          <td>
                            <input type="number" value={editPlayerForm.jersey_number} onChange={e => setEditPlayerForm({...editPlayerForm, jersey_number: e.target.value})} className={styles.editInput} />
                          </td>
                          <td className={styles.leftAlign}>
                            <input type="text" value={editPlayerForm.name} onChange={e => setEditPlayerForm({...editPlayerForm, name: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                          </td>
                          <td className={styles.leftAlign}>
                            <input type="text" value={editPlayerForm.role} onChange={e => setEditPlayerForm({...editPlayerForm, role: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                          </td>
                          <td><input type="number" value={editPlayerForm.ma} onChange={e => setEditPlayerForm({...editPlayerForm, ma: Number(e.target.value)})} className={styles.editInput} /></td>
                          <td><input type="number" value={editPlayerForm.st} onChange={e => setEditPlayerForm({...editPlayerForm, st: Number(e.target.value)})} className={styles.editInput} /></td>
                          <td><input type="text" value={editPlayerForm.ag} onChange={e => setEditPlayerForm({...editPlayerForm, ag: e.target.value})} className={styles.editInput} /></td>
                          <td><input type="text" value={editPlayerForm.pa} onChange={e => setEditPlayerForm({...editPlayerForm, pa: e.target.value})} className={styles.editInput} /></td>
                          <td><input type="text" value={editPlayerForm.av} onChange={e => setEditPlayerForm({...editPlayerForm, av: e.target.value})} className={styles.editInput} /></td>

                          {/* SPP BLOCCATI */}
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-impact)', fontSize: '1.4rem', color: '#666' }}>{player.spp}</td>

                          {/* SKILLS BLOCCATE */}
                          <td className={styles.leftAlign}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                              {player.skills && player.skills.map((s: any) => (
                                  <span key={s.id} style={{ background: '#555', color: '#fff', padding: '0.2rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                                  {formatSkillName(s.name)}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td>
                            <input type="number" value={editPlayerForm.value} onChange={e => setEditPlayerForm({...editPlayerForm, value: Number(e.target.value)})} className={styles.editInput} />
                          </td>

                          {/* TOGGLE MNG E DEAD */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', fontWeight: 'bold' }}>
                                <input type="checkbox" checked={editPlayerForm.mng} onChange={e => setEditPlayerForm({...editPlayerForm, mng: e.target.checked})} style={{accentColor: '#f59e0b'}} /> MNG
                              </label>
                              <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-blood-bright)', fontWeight: 'bold' }}>
                                <input type="checkbox" checked={editPlayerForm.dead} onChange={e => setEditPlayerForm({...editPlayerForm, dead: e.target.checked})} style={{accentColor: 'var(--color-blood-bright)'}} /> RIP
                              </label>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button onClick={() => handleSavePlayerEdit(player.id)} style={{ background: 'var(--color-grass)', color: '#111', border: '2px solid #111', padding: '0.5rem', cursor: 'pointer', boxShadow: '2px 2px 0 #111' }} title="Save"><Save size={18} /></button>
                              <button onClick={() => setEditingPlayerId(null)} style={{ background: 'var(--color-paper)', color: 'var(--color-blood-bright)', border: '2px solid var(--color-ink)', padding: '0.5rem', cursor: 'pointer', boxShadow: '2px 2px 0 var(--color-ink)' }} title="Cancel"><X size={18} /></button>
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
                  const canLevelUp = !isDead && (player.spp >= costOfNextLevel);

                  const totalSkills = player.skills?.length || 0;
                  const earnedCount = player.advancements || 0;
                  const startingCount = Math.max(0, totalSkills - earnedCount);

                  return (
                      <tr key={player.id} style={{ opacity: isDead ? 0.4 : 1, background: isDead ? '#ddd' : 'transparent' }}>

                        {/* JERSEY ICONA REINTEGRATA */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ position: 'relative', width: '45px', height: '45px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 64 64" style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, zIndex: 0, filter: 'drop-shadow(2px 2px 0px rgba(0,0,0,0.4))' }}>
                              <path d="M16 8 L48 8 L60 24 L50 32 L46 28 L46 60 L18 60 L18 28 L14 32 L4 24 Z" fill={team.primary_color || '#333'} stroke={team.secondary_color || '#111'} strokeWidth="3" strokeLinejoin="round" />
                            </svg>
                            <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-impact)', fontSize: '1.4rem', color: '#fff', textShadow: `1px 1px 0px ${team.secondary_color || '#000'}` }}>
                              {player.jersey_number || '-'}
                            </span>
                          </div>
                        </td>

                        <td className={`${styles.leftAlign} ${styles.playerName}`} style={{ textDecoration: isDead ? 'line-through' : 'none' }}>
                          {player.name}
                        </td>

                        {/* RUOLO CON STELLE AVANZAMENTO REINTEGRATE */}
                        <td className={`${styles.leftAlign} ${styles.playerRole}`}>
                          {player.role}
                          {player.advancements > 0 && (
                              <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                                {Array.from({ length: player.advancements }).map((_, idx) => (
                                    <span key={idx} style={{ color: 'var(--color-gold)', fontSize: '0.9rem', lineHeight: 1 }}>★</span>
                                ))}
                              </div>
                          )}
                        </td>

                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.ma ?? 6}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.st ?? 3}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.ag ?? '3+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.pa ?? '4+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.av ?? '8+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.5rem', color: isDead ? '#666' : 'var(--color-gold)' }}>{player.spp ?? 0}</td>

                        {/* VISUALIZZAZIONE SKILLS CON LINK ALLA PAGINA REGOLAMENTO */}
                        <td className={styles.leftAlign}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {player.skills && Array.isArray(player.skills) && player.skills.map((s: any, i: number) => {
                              const isEarned = i >= startingCount;
                              const bg = isDead ? '#888' : (isEarned ? 'var(--color-gold)' : 'var(--color-ink)');
                              const color = isEarned ? '#111' : '#fff';

                              return (
                                  <span
                                      key={s.id}
                                      onClick={() => router.push(`/skills?expandedId=${s.id}`)}
                                      className={styles.playerSkill}
                                      style={{ background: bg, color: color, fontWeight: isEarned ? 'bold' : 'normal', cursor: 'pointer' }}
                                      title="Vedi dettagli abilità"
                                  >
                                    {formatSkillName(s.name)}
                                  </span>
                              );
                            })}
                          </div>
                        </td>

                        <td style={{ textDecoration: isDead ? 'line-through' : 'none' }}>{player.value.toLocaleString()}</td>

                        {/* VISUALIZZAZIONE STATO */}
                        <td style={{ textAlign: 'center' }}>
                          {isDead ? (
                              <Skull size={24} color="var(--color-blood-bright)" style={{ margin: '0 auto' }} />
                          ) : isMNG ? (
                              <span style={{ color: '#f59e0b', fontWeight: 'bold', fontFamily: 'var(--font-impact)', fontSize: '1.2rem', padding: '0.2rem 0.5rem', border: '2px solid #f59e0b' }}>MNG</span>
                          ) : (
                              <span style={{ color: '#4ade80', fontSize: '1.5rem' }}>&bull;</span>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            {canLevelUp && (
                                <button onClick={() => setLevelUpPlayer(player)} style={{ background: 'none', border: 'none', color: 'var(--color-gold)', cursor: 'pointer' }} title="SPP Advancement"><ArrowUpCircle size={24} /></button>
                            )}
                            <button onClick={() => startEditPlayer(player)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }} title="Edit"><Edit2 size={20} /></button>
                            <button onClick={() => handleDeletePlayer(player.id, player.name)} style={{ background: 'none', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer' }} title="Fire (Permanent Delete)"><Trash2 size={20} /></button>
                          </div>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );
}