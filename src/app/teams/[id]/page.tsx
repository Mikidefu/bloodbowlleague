'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
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
import { ADVANCEMENT_TIERS, MAX_ADVANCEMENTS, SKILL_CATEGORY_LETTERS, categoryLetters, categoryName, isEliteSkill, skillsForCategories } from '@/lib/advancement';
import { CHARACTERISTIC_VALUES, parseCharacteristic, statLabel, type Characteristics, type StatKey } from '@/lib/characteristics';
import { isTrue, type Coach, type Player, type Skill, type TeamWithPlayers } from '@/lib/types';
import { ROSTERS, favouredOptions, getRoster, type SkillCategory } from '@/lib/rosters';
import { LEAGUE_REROLL_MULTIPLIER, LIMITS, STAFF_COSTS } from '@/lib/leagueRules';
import { mustAdvance } from '@/lib/players';
import PostgamePanel from './PostgamePanel';

const SORTED_ROSTERS = [...ROSTERS].sort((a, b) => a.name.localeCompare(b.name));

// Le caratteristiche si scelgono dai valori ammessi (p. 37), non si scrivono a mano:
// il profilo che arriva all'API è sempre valido.
function StatSelect<K extends StatKey>(
    { stat, value, onChange, className }: { stat: K; value: Characteristics[K]; onChange: (value: Characteristics[K]) => void; className: string },
) {
  return (
      <select aria-label={statLabel(stat)} className={className} value={String(value)}
              onChange={e => onChange(parseCharacteristic(stat, e.target.value) ?? value)}>
        {CHARACTERISTIC_VALUES[stat].map(option => <option key={String(option)} value={String(option)}>{option}</option>)}
      </select>
  );
}

// Aggiunge o toglie una categoria dall'elenco "G, A"
const toggleCategory = (current: string, letter: SkillCategory) => {
  const letters = categoryLetters(current);
  return (letters.includes(letter) ? letters.filter(l => l !== letter) : [...letters, letter]).join(', ');
};

// Profilo modificabile dal form: le caratteristiche hanno gli stessi tipi del giocatore
type PlayerFormState = Characteristics & {
  jersey_number: string; name: string; role: string; value: number;
  skills: Skill[]; primary_skills: string; secondary_skills: string; spp: number;
};

type EditPlayerFormState = PlayerFormState & {
  advancements: number; mng: boolean; dead: boolean; position_key: string;
};

// Risposte di POST /api/players/[id]/advance/roll
type RandomRoll = { category: string; cost: number; token: string; options: { id: string; name: string; type: string; elite: boolean; rolls: number[] }[] };
type StatRoll = { cost: number; token: string; d8: number; label: string; stats: { stat: string; current: string | number; times: number; available: boolean; reason: string | null }[] };

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
    rerolls: 0, reroll_cost: 50000, cheerleaders: 0, assistant_coaches: 0, fan_factor: 1, apothecary: false,
    treasury: 0, bank: 0, roster: '', team_league: '', favoured_of: ''
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

  // Arrivando dal post-partita guidato (/teams/<id>?advance=<giocatore>&back=/schedule/<partita>)
  // si apre subito l'avanzamento e compare il pulsante per tornare alla partita
  const [backTo, setBackTo] = useState<string | null>(null);
  const advanceOpened = useRef(false);

  // Level Up State
  const [levelUpPlayer, setLevelUpPlayer] = useState<Player | null>(null);
  const [levelUpChoice, setLevelUpChoice] = useState<string>('');
  const [selectedAdvancement, setSelectedAdvancement] = useState<Skill | null>(null);
  // Tiri fatti dal server (pp. 97-98): la scelta è vincolata ai risultati usciti
  const [randomRoll, setRandomRoll] = useState<RandomRoll | null>(null);
  const [statRoll, setStatRoll] = useState<StatRoll | null>(null);
  const [rollCategory, setRollCategory] = useState('');
  const [rolling, setRolling] = useState(false);
  const [declinedFrom, setDeclinedFrom] = useState<'primary' | 'secondary'>('primary');

  // NUOVO STATO: Modale Celebrazione Skill Random
  const [celebrationSkill, setCelebrationSkill] = useState<Skill | null>(null);

  // Autocomplete State (Solo per la Creazione)
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<Skill[]>([]);

  const [editPlayerForm, setEditPlayerForm] = useState<EditPlayerFormState>({
    jersey_number: '', name: '', role: '', value: 0,
    primary_skills: '', secondary_skills: '', advancements: 0,
    skills: [],
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0,
    mng: false, dead: false, position_key: ''
  });

  // Ingaggio da Team Roster
  const [hireForm, setHireForm] = useState({ position_key: '', name: '', jersey_number: '' });
  const [staffBusy, setStaffBusy] = useState(false);

  const [playerForm, setPlayerForm] = useState<PlayerFormState>({
    jersey_number: '', name: '', role: 'Lineman', value: 50000, skills: [],
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

      const query = new URLSearchParams(window.location.search);
      const back = query.get('back');
      if (back && /^\/schedule\/[\w-]+$/.test(back)) setBackTo(back);   // solo pagine partita: niente redirect esterni
      const advance = query.get('advance');
      if (advance && !advanceOpened.current) {
        advanceOpened.current = true;
        const player = (teamData.players as Player[]).find(pl => pl.id === advance);
        if (player) setLevelUpPlayer(player);
      }
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
      setRandomRoll(null); setStatRoll(null); setRollCategory('');
      fetchTeamAndSkills();
      return data;
    } catch {
      alert('Errore di connessione');
      return null;
    }
  };

  // --- TIRI (il server tira e firma il risultato, vedi /advance/roll) ---
  const rollFor = async (kind: 'randomPrimary' | 'stat', category?: string) => {
    if (!levelUpPlayer) return;
    setRolling(true);
    try {
      const res = await fetch(`/api/players/${levelUpPlayer.id}/advance/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, category })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || 'Errore nel tiro');
      setSelectedAdvancement(null);
      if (kind === 'randomPrimary') { setRandomRoll(data); setStatRoll(null); }
      else { setStatRoll(data); setRandomRoll(null); }
    } catch {
      alert('Errore di connessione');
    } finally {
      setRolling(false);
    }
  };

  // Skill estratta dalla Skill Table: si sceglie una delle due uscite (p. 97)
  const handleRandomChoice = async (skillId: string) => {
    const data = await requestAdvancement({ kind: 'randomPrimary', skill_id: skillId, token: randomRoll!.token });
    if (data?.skill) setCelebrationSkill(data.skill);
  };

  // --- LOGICA LEVEL UP STANDARD (Scelta Manuale) ---
  const handleLevelUpSave = async () => {
    if (!levelUpChoice) return alert('Seleziona un potenziamento!');

    if (levelUpChoice === 'choosePrimary' || levelUpChoice === 'chooseSecondary') {
      if (!selectedAdvancement) return alert('Seleziona una skill!');
      await requestAdvancement({ kind: levelUpChoice, skill_id: selectedAdvancement.id });
    } else if (levelUpChoice === 'statDeclined') {
      if (!selectedAdvancement || !statRoll) return alert('Seleziona una skill!');
      await requestAdvancement({
        kind: 'statDeclined', skill_id: selectedAdvancement.id, token: statRoll.token,
        from: declinedFrom,
      });
    } else if (levelUpChoice.startsWith('stat_')) {
      await requestAdvancement({ kind: 'stat', stat: levelUpChoice.split('_')[1], token: statRoll!.token });
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
      fan_factor: team.fan_factor || 1, apothecary: isTrue(team.apothecary), treasury: team.treasury || 0, bank: team.bank || 0,
      roster: team.roster || '', team_league: team.team_league || '', favoured_of: team.favoured_of || ''
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
      submitData.append('roster', editForm.roster); submitData.append('team_league', editForm.team_league); submitData.append('favoured_of', editForm.favoured_of);

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
          skills: skillIds, ma: playerForm.ma, st: playerForm.st, ag: playerForm.ag, pa: playerForm.pa, av: playerForm.av,
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

  // Ingaggio dal Team Roster: profilo, costo e limiti li decide il server (p. 99)
  const handleHireFromRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: id, position_key: hireForm.position_key, name: hireForm.name,
          jersey_number: hireForm.jersey_number ? Number(hireForm.jersey_number) : null,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setHireForm({ position_key: '', name: '', jersey_number: '' });
        setShowPlayerForm(false);
        fetchTeamAndSkills();
      } else { alert(data.error || 'Failed to hire player'); }
    } catch { alert('Error hiring player'); }
    finally { setIsSubmitting(false); }
  };

  // Staff e Team Re-roll pagati dalla Treasury (p. 90)
  const handleStaff = async (item: string, action: 'hire' | 'fire') => {
    setStaffBusy(true);
    try {
      const res = await fetch(`/api/teams/${id}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, action })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || 'Error');
      fetchTeamAndSkills();
    } catch { alert('Error'); }
    finally { setStaffBusy(false); }
  };

  const handleTempRetire = async (player: Player) => {
    const res = await fetch(`/api/players/${player.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_retired: !isTrue(player.temp_retired) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || 'Error');
    fetchTeamAndSkills();
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!confirm(t.teamDetail.confirmFire.replace('{playerName}', name))) return;
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || 'Failed to fire player');
      fetchTeamAndSkills();
    } catch { alert('Failed to fire player'); }
  };

  const startEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      jersey_number: player.jersey_number != null ? String(player.jersey_number) : '', name: player.name, role: player.role, value: player.value,
      primary_skills: player.primary_skills || '', secondary_skills: player.secondary_skills || '', advancements: player.advancements || 0,
      skills: player.skills || [], // Le skills originali (non verranno modificate dalla UI)
      ma: player.ma, st: player.st, ag: player.ag, pa: player.pa, av: player.av,
      spp: player.spp, mng: player.mng, dead: player.dead, position_key: player.position_key || ''
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
          ma: editPlayerForm.ma, st: editPlayerForm.st, ag: editPlayerForm.ag, pa: editPlayerForm.pa, av: editPlayerForm.av,
          mng: editPlayerForm.mng, dead: editPlayerForm.dead, position_key: editPlayerForm.position_key || undefined
          // NOTA BENE: Non inviamo "skills" né "spp", così il backend non li tocca!
        })
      });

      if (res.ok) { setEditingPlayerId(null); fetchTeamAndSkills(); }
      else { alert('Failed to update player'); }
    } catch { alert('Error updating player'); }
  };

  if (loading || !team) return <div className="loading-state">Loading locker room...</div>;

  // Chi ha lasciato la squadra resta nel database per lo storico ma non compare nel roster
  const listedPlayers = team.players.filter(p => !isTrue(p.left_team));
  const activePlayers = listedPlayers.filter(p => !isTrue(p.dead));
  // Massimo 16 sulla Team Draft List; i Journeymen in attesa del post-partita non contano (p. 94)
  const draftListCount = activePlayers.filter(p => !isTrue(p.journeyman)).length;

  // Team Value e Current Team Value calcolati dal server (src/lib/teamValue.ts, p. 91)
  const totalValue = team.tv;
  const roster = getRoster(team.roster);
  // Post-partita concluso (p. 95): rosa e staff si toccano di nuovo dopo la prossima partita
  const locked = team.postgame_phase === 'closed';
  const editRoster = getRoster(editForm.roster);
  const editFavoured = favouredOptions(editRoster, editForm.team_league);
  const hirePosition = roster?.positions.find(p => p.key === hireForm.position_key) ?? null;

  const sortedPlayers = [...listedPlayers].sort((a, b) => {
    const aDead = isTrue(a.dead);
    const bDead = isTrue(b.dead);
    if (aDead && !bDead) return 1;
    if (!aDead && bDead) return -1;
    return (a.jersey_number || 99) - (b.jersey_number || 99);
  });

  // Colore squadra usato solo come accento (filetti e bordi), mai come fondo del testo
  const teamAccent = { '--team-accent': team.primary_color || 'var(--bb-mustard)', '--team-accent-2': team.secondary_color || 'var(--bb-tan)' } as React.CSSProperties;

  const tier = levelUpPlayer ? ADVANCEMENT_TIERS[Math.min(levelUpPlayer.advancements || 0, 5)] : null;
  // Categorie primarie del giocatore: da qui si sceglie su quale colonna della Skill Table tirare (p. 97)
  const primaryLetters = categoryLetters(levelUpPlayer?.primary_skills);
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
    { label: t.rules.teamRoster, value: roster ? `${roster.name} (p. ${roster.page})` : <span>{t.rules.linkRoster}</span> },
    ...(team.team_league ? [{ label: t.rules.league, value: team.team_league }] : []),
    ...(team.favoured_of ? [{ label: t.rules.favouredOf, value: team.favoured_of }] : []),
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
              <span className={`team-patch ${styles.logoFrame}`}>
                {team.logo_url ? (
                    <img src={team.logo_url} alt="" />
                ) : (
                    <ShieldAlert size={40} />
                )}
              </span>
            }
            subtitle={<span title={t.rules.tvHint}>{t.rules.tv}: <strong>{totalValue.toLocaleString()} GP</strong> · {t.rules.ctv}: <strong>{team.ctv.toLocaleString()} GP</strong></span>}
            actions={isAdmin ? (
                <>
                  <button className="btn" onClick={openEditTeam}><Edit2 size={18} /><span>EDIT</span></button>
                  <button className="btn btn-primary" onClick={handleDeleteTeam}><Trash2 size={18} /><span>DISBAND</span></button>
                </>
            ) : undefined}
        />

        {backTo && (
            <p className={styles.backToMatch}>
              <span>{t.rules.fromPostgame}</span>
              <Link href={backTo} className="btn btn-primary">{t.rules.backToMatch}</Link>
            </p>
        )}

        {/* PROFILO SQUADRA (scheda personaggio) */}
        <section className={`bleed ${styles.profileBand}`} aria-labelledby="team-profile-name">
          <Shards variant="header" className={styles.profileShards} />
          <span className={`ghost-text ${styles.ghostRace}`} aria-hidden="true">{team.race}</span>

          <div className={styles.profileInner}>
            <div className={styles.portrait}>
              <span className={styles.portraitShard} aria-hidden="true" />
              <span className={styles.portraitCount} aria-hidden="true">{pad(activePlayers.length)}</span>
              <span className={styles.portraitMicro} aria-hidden="true">{`Roster // ${activePlayers.length} of 16`}</span>

              <span className={`team-patch ${styles.badge}`}>
                {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} />
                ) : (
                    <ShieldAlert size={120} />
                )}
              </span>

              <span className={`tag ${styles.portraitRace}`}>{team.race}</span>

              <span className={`chamfer ${styles.portraitValue}`} title={t.rules.tvHint}>
                <small>{t.rules.tv} · {t.rules.ctv} {team.ctv.toLocaleString()}</small>
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
              <span className={styles.plateLabel}>{t.rules.dedicatedFans}</span>
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

          {/* STAFF: acquisti durante la lega pagati dalla Treasury (p. 90) */}
          {isAdmin && roster && (
              <div className={styles.staffBar}>
                <span className={styles.staffTitle}>{t.rules.staff}</span>
                {([
                  { item: 'reroll', label: t.rules.rerollLeague, count: team.rerolls || 0, max: LIMITS.maxRerolls, cost: roster.rerollCost * LEAGUE_REROLL_MULTIPLIER, canFire: false, allowed: true },
                  { item: 'assistant_coach', label: t.rules.assistantCoach, count: team.assistant_coaches || 0, max: LIMITS.maxAssistantCoaches, cost: STAFF_COSTS.assistantCoach, canFire: true, allowed: true },
                  { item: 'cheerleader', label: t.rules.cheerleader, count: team.cheerleaders || 0, max: LIMITS.maxCheerleaders, cost: STAFF_COSTS.cheerleader, canFire: true, allowed: true },
                  { item: 'apothecary', label: t.rules.apothecary, count: isTrue(team.apothecary) ? 1 : 0, max: LIMITS.maxApothecaries, cost: STAFF_COSTS.apothecary, canFire: true, allowed: roster.apothecary },
                ]).filter(s => s.allowed).map(s => (
                    <span key={s.item} className={`chamfer ${styles.staffItem}`}>
                      <span>{s.label}: <strong>{s.count}/{s.max}</strong></span>
                      <button type="button" className="btn btn-navy" disabled={locked || staffBusy || s.count >= s.max || (team.treasury || 0) < s.cost} onClick={() => handleStaff(s.item, 'hire')}>
                        {t.rules.buy} {s.cost.toLocaleString()}
                      </button>
                      {s.canFire && (
                          <button type="button" className="btn" disabled={locked || staffBusy || s.count <= 0} onClick={() => handleStaff(s.item, 'fire')}>{t.rules.fire}</button>
                      )}
                    </span>
                ))}
              </div>
          )}
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
                      onClick={() => { setLevelUpChoice('randomPrimary'); setStatRoll(null); setRandomRoll(null); setRollCategory(primaryLetters[0] ?? ''); }}
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
                      className={choiceClass(levelUpChoice.startsWith('stat') || levelUpChoice === 'statDeclined')}
                      onClick={() => { setLevelUpChoice('stat'); setRandomRoll(null); setStatRoll(null); setSelectedAdvancement(null); }}
                  >
                    <span>Characteristic ({tier.stat} SPP)</span>
                  </button>
                </div>

                {/* Skill casuale: si sceglie la categoria, il server tira 2D6 due volte (pp. 97, 121) */}
                {levelUpChoice === 'randomPrimary' && (
                    <div className={styles.rollBlock}>
                      <div className={styles.rollRow}>
                        {primaryLetters.length > 1 && (
                            <select value={rollCategory} onChange={e => { setRollCategory(e.target.value); setRandomRoll(null); }} className={`${styles.inputField} ${styles.modalSelect}`}>
                              {primaryLetters.map(l => <option key={l} value={l}>{categoryName(l)}</option>)}
                            </select>
                        )}
                        <button className="btn btn-gold" disabled={rolling || !rollCategory} onClick={() => rollFor('randomPrimary', rollCategory)}>
                          <Dices size={18} /> <span>{randomRoll ? 'RITIRA' : 'TIRA'} 2D6 · {categoryName(rollCategory)}</span>
                        </button>
                      </div>
                      {randomRoll && (
                          <div className={styles.rollOptions}>
                            <span className={styles.rollHint}>Scegli una delle due skill uscite:</span>
                            {randomRoll.options.map(o => (
                                <button key={o.id} className={`btn ${styles.rollOption}`} onClick={() => handleRandomChoice(o.id)}>
                                  <span>{formatSkillName(o.name)} <small>({o.rolls.join(' + ')}{o.elite ? ' · Elite +10.000' : ''})</small></span>
                                </button>
                            ))}
                          </div>
                      )}
                    </div>
                )}

                {/* Caratteristica: D8 sulla Characteristic Improvement Table (p. 98) */}
                {(levelUpChoice === 'stat' || levelUpChoice.startsWith('stat_') || levelUpChoice === 'statDeclined') && (
                    <div className={styles.rollBlock}>
                      <div className={styles.rollRow}>
                        <button className="btn btn-gold" disabled={rolling} onClick={() => { setLevelUpChoice('stat'); rollFor('stat'); }}>
                          <Dices size={18} /> <span>{statRoll ? 'RITIRA' : 'TIRA'} D8</span>
                        </button>
                        {statRoll && <span className={styles.rollHint}>D8 = {statRoll.d8}: {statRoll.label}</span>}
                      </div>
                      {statRoll && (
                          <>
                            <div className={styles.statChoices}>
                              {statRoll.stats.map(s => (
                                  <button key={s.stat} className={choiceClass(levelUpChoice === `stat_${s.stat}`)} disabled={!s.available}
                                          title={s.reason === 'max' ? 'Già al massimo' : s.reason === 'twice' ? 'Già migliorata due volte' : ''}
                                          onClick={() => { setLevelUpChoice(`stat_${s.stat}`); setSelectedAdvancement(null); }}>
                                    <span>+{s.stat.toUpperCase()} <small>({String(s.current)})</small></span>
                                  </button>
                              ))}
                            </div>
                            <button className={`btn ${styles.declineBtn}`} onClick={() => { setLevelUpChoice('statDeclined'); setSelectedAdvancement(null); }}>
                              <span>Rifiuta il tiro e prendi una skill (gli SPP restano spesi)</span>
                            </button>
                            {levelUpChoice === 'statDeclined' && (
                                <div className={styles.rollRow}>
                                  <select value={declinedFrom} onChange={e => { setDeclinedFrom(e.target.value as 'primary' | 'secondary'); setSelectedAdvancement(null); }} className={`${styles.inputField} ${styles.modalSelect}`}>
                                    <option value="primary">Primary</option>
                                    <option value="secondary">Secondary</option>
                                  </select>
                                  <select value={selectedAdvancement?.id ?? ''} onChange={e => setSelectedAdvancement(availableSkills.find(s => s.id === e.target.value) ?? null)} className={`${styles.inputField} ${styles.modalSelect}`}>
                                    <option value="">Select a skill...</option>
                                    {getFilteredSkillsForLevelUp(declinedFrom).map(s => (
                                        <option key={s.id} value={s.id}>{formatSkillName(s.name)} ({s.type}){isEliteSkill(s.name) ? ' · Elite +10.000' : ''}</option>
                                    ))}
                                  </select>
                                </div>
                            )}
                          </>
                      )}
                    </div>
                )}

                {(levelUpChoice === 'choosePrimary' || levelUpChoice === 'chooseSecondary') && (
                    <select onChange={(e) => setSelectedAdvancement(availableSkills.find(s => s.id === e.target.value) ?? null)} className={`${styles.inputField} ${styles.modalSelect}`}>
                      <option value="">Select a skill...</option>
                      {getFilteredSkillsForLevelUp(levelUpChoice === 'choosePrimary' ? 'primary' : 'secondary').map(s => (
                          <option key={s.id} value={s.id}>{formatSkillName(s.name)} ({s.type}){isEliteSkill(s.name) ? ' · Elite +10.000' : ''}</option>
                      ))}
                    </select>
                )}

                <button
                    className={`btn btn-primary ${styles.fullWidth}`}
                    onClick={handleLevelUpSave}
                    disabled={levelUpChoice === '' || levelUpChoice === 'randomPrimary' || levelUpChoice === 'stat'}
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

                {/* Collegamento al Team Roster (squadre create prima dei roster) */}
                <div className={styles.grid3Col}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label} htmlFor="edit-roster">{t.rules.teamRoster}</label>
                    <select id="edit-roster" value={editForm.roster} className={styles.inputField}
                            onChange={e => {
                              const next = getRoster(e.target.value);
                              const league = next?.leagues.length === 1 ? next.leagues[0] : '';
                              const favoured = favouredOptions(next, league);
                              setEditForm({ ...editForm, roster: e.target.value, team_league: league, favoured_of: favoured.length === 1 ? favoured[0] : '' });
                            }}>
                      <option value="">—</option>
                      {SORTED_ROSTERS.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  </div>
                  {editRoster && (
                      <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="edit-league">{t.rules.league}</label>
                        <select id="edit-league" value={editForm.team_league} className={styles.inputField}
                                onChange={e => {
                                  const favoured = favouredOptions(editRoster, e.target.value);
                                  setEditForm({ ...editForm, team_league: e.target.value, favoured_of: favoured.length === 1 ? favoured[0] : '' });
                                }}>
                          <option value="">{t.rules.chooseLeague}</option>
                          {editRoster.leagues.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                  )}
                  {editFavoured.length > 0 && (
                      <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="edit-favoured">{t.rules.favouredOf}</label>
                        <select id="edit-favoured" value={editForm.favoured_of} onChange={e => setEditForm({ ...editForm, favoured_of: e.target.value })} className={styles.inputField}>
                          <option value="">{t.rules.chooseFavoured}</option>
                          {editFavoured.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                  )}
                </div>

                <div className={styles.gridStats}>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.rerolls}</label>
                    <input type="number" min="0" max={LIMITS.maxRerolls} value={editForm.rerolls} onChange={e => setEditForm({...editForm, rerolls: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  {!editRoster && (
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>R. COST</label>
                        <input type="number" min="0" step="10000" value={editForm.reroll_cost} onChange={e => setEditForm({...editForm, reroll_cost: parseInt(e.target.value) || 0})} className={styles.statInput} />
                      </div>
                  )}
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.cheerleaders}</label>
                    <input type="number" min="0" max={LIMITS.maxCheerleaders} value={editForm.cheerleaders} onChange={e => setEditForm({...editForm, cheerleaders: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>ASST. COACHES</label>
                    <input type="number" min="0" max={LIMITS.maxAssistantCoaches} value={editForm.assistant_coaches} onChange={e => setEditForm({...editForm, assistant_coaches: parseInt(e.target.value) || 0})} className={styles.statInput} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.fanFactor}</label>
                    <input type="number" min={LIMITS.dedicatedFansMin} max={LIMITS.dedicatedFansMax} value={editForm.fan_factor} onChange={e => setEditForm({...editForm, fan_factor: parseInt(e.target.value) || 1})} className={styles.statInput} />
                  </div>
                  <div className={`${styles.inputGroup} ${styles.checkGroup}`}>
                    <label className={styles.checkLabel}>
                      <span>APOTHECARY</span>
                      <input type="checkbox" checked={editForm.apothecary} disabled={!!editRoster && !editRoster.apothecary} onChange={e => setEditForm({...editForm, apothecary: e.target.checked})} className={styles.checkbox} />
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
                micro={`Roster sheet // ${draftListCount} of ${LIMITS.maxPlayers}`}
                title={`ROSTER (${draftListCount} / ${LIMITS.maxPlayers})`}
                action={isAdmin && !locked && !showPlayerForm && draftListCount < LIMITS.maxPlayers ? (
                    <button className="btn btn-primary" onClick={() => setShowPlayerForm(true)}>
                      <Plus size={20} /><span>{t.teamDetail.hirePlayer}</span>
                    </button>
                ) : undefined}
            />

            <PostgamePanel team={team} isAdmin={isAdmin} onChange={fetchTeamAndSkills} />
            {isAdmin && locked && <p className={styles.postgameClosed}>{t.rules.postgameClosed}</p>}

            {/* INGAGGIO DAL TEAM ROSTER */}
            {showPlayerForm && roster && (
                <div className={`card ${styles.formCard}`}>
                  <h3 className="subhead">{t.rules.hireFromRoster}</h3>
                  <form onSubmit={handleHireFromRoster}>
                    <div className={styles.grid3Col}>
                      <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="hire-position">{t.rules.position}</label>
                        <select id="hire-position" required value={hireForm.position_key} className={styles.inputField}
                                onChange={e => {
                                  const pos = roster.positions.find(p => p.key === e.target.value);
                                  setHireForm({ ...hireForm, position_key: e.target.value, name: hireForm.name || (pos ? pos.name : '') });
                                }}>
                          <option value="">—</option>
                          {roster.positions.map(pos => {
                            const count = activePlayers.filter(p => p.position_key === pos.key && !isTrue(p.journeyman)).length;
                            return (
                                <option key={pos.key} value={pos.key} disabled={count >= pos.max || (team.treasury || 0) < pos.cost}>
                                  {pos.name} · {pos.cost.toLocaleString()} gp · {count}/{pos.max}
                                </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="hire-name">{t.teamDetail.name}</label>
                        <input id="hire-name" type="text" required value={hireForm.name} onChange={e => setHireForm({ ...hireForm, name: e.target.value })} className={styles.inputField} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={styles.label} htmlFor="hire-number">N°</label>
                        <input id="hire-number" type="number" min="1" max="99" value={hireForm.jersey_number} onChange={e => setHireForm({ ...hireForm, jersey_number: e.target.value })} className={`${styles.inputField} ${styles.center}`} />
                      </div>
                    </div>
                    {hirePosition && (
                        <p className={styles.hireSummary}>
                          MA {hirePosition.ma} · ST {hirePosition.st} · AG {hirePosition.ag} · PA {hirePosition.pa} · AV {hirePosition.av}
                          {' · '}{hirePosition.skills.join(', ') || '—'}
                          {' · '}{t.rules.hireCost}: <strong>{hirePosition.cost.toLocaleString()} gp</strong> ({t.rules.treasury} {(team.treasury || 0).toLocaleString()})
                        </p>
                    )}
                    <div className={styles.formActions}>
                      <button type="button" className="btn" onClick={() => setShowPlayerForm(false)}><span>CANCEL</span></button>
                      <button type="submit" className="btn btn-primary" disabled={isSubmitting || !hirePosition}><span>SIGN CONTRACT</span></button>
                    </div>
                  </form>
                </div>
            )}

            {/* ADD PLAYER FORM (squadre senza Team Roster) */}
            {showPlayerForm && !roster && (
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

                    {/* CATEGORIE SKILL: solo le sei del regolamento (p. 121) */}
                    <div className={styles.grid2Col}>
                      {([['primary_skills', 'PRIMARY SKILLS'], ['secondary_skills', 'SECONDARY SKILLS']] as const).map(([field, label]) => (
                          <div key={field} className={styles.inputGroup}>
                            <label className={styles.label}>{label}</label>
                            <div className={styles.categoryList}>
                              {SKILL_CATEGORY_LETTERS.map(letter => (
                                  <label key={letter} className={styles.toggle} title={categoryName(letter)}>
                                    <input type="checkbox" className={styles.checkbox}
                                           checked={categoryLetters(playerForm[field]).includes(letter)}
                                           onChange={() => setPlayerForm({ ...playerForm, [field]: toggleCategory(playerForm[field], letter) })} />
                                    {letter}
                                  </label>
                              ))}
                            </div>
                          </div>
                      ))}
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
                        <StatSelect stat="ma" value={playerForm.ma} className={styles.statInput} onChange={ma => setPlayerForm({ ...playerForm, ma })} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thST}</label>
                        <StatSelect stat="st" value={playerForm.st} className={styles.statInput} onChange={st => setPlayerForm({ ...playerForm, st })} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thAG}</label>
                        <StatSelect stat="ag" value={playerForm.ag} className={styles.statInput} onChange={ag => setPlayerForm({ ...playerForm, ag })} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thPA}</label>
                        <StatSelect stat="pa" value={playerForm.pa} className={styles.statInput} onChange={pa => setPlayerForm({ ...playerForm, pa })} />
                      </div>
                      <div className={styles.inputGroup}>
                        <label className={`${styles.label} ${styles.labelCenter}`}>{t.teamDetail.thAV}</label>
                        <StatSelect stat="av" value={playerForm.av} className={styles.statInput} onChange={av => setPlayerForm({ ...playerForm, av })} />
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
                      <span className={styles.tableStripMeta}>{`${team.race} // ${draftListCount} / ${LIMITS.maxPlayers}`}</span>
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
                        <th className="num" title={t.rules.nigglingTitle}>{t.rules.niggling}</th>
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
                                  {roster ? (
                                      <select value={editPlayerForm.position_key} aria-label={t.rules.position}
                                              onChange={e => setEditPlayerForm({ ...editPlayerForm, position_key: e.target.value, role: roster.positions.find(pos => pos.key === e.target.value)?.name ?? editPlayerForm.role })}
                                              className={`${styles.editInput} ${styles.editInputTxt}`}>
                                        <option value="">{editPlayerForm.role}</option>
                                        {roster.positions.map(pos => <option key={pos.key} value={pos.key}>{pos.name}</option>)}
                                      </select>
                                  ) : (
                                      <input type="text" value={editPlayerForm.role} onChange={e => setEditPlayerForm({...editPlayerForm, role: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                                  )}
                                </td>
                                <td><StatSelect stat="ma" value={editPlayerForm.ma} className={styles.editInput} onChange={ma => setEditPlayerForm({ ...editPlayerForm, ma })} /></td>
                                <td><StatSelect stat="st" value={editPlayerForm.st} className={styles.editInput} onChange={st => setEditPlayerForm({ ...editPlayerForm, st })} /></td>
                                <td><StatSelect stat="ag" value={editPlayerForm.ag} className={styles.editInput} onChange={ag => setEditPlayerForm({ ...editPlayerForm, ag })} /></td>
                                <td><StatSelect stat="pa" value={editPlayerForm.pa} className={styles.editInput} onChange={pa => setEditPlayerForm({ ...editPlayerForm, pa })} /></td>
                                <td><StatSelect stat="av" value={editPlayerForm.av} className={styles.editInput} onChange={av => setEditPlayerForm({ ...editPlayerForm, av })} /></td>

                                {/* SPP BLOCCATI */}
                                <td className={`num ${styles.statCell} ${styles.locked}`}>{player.spp}</td>
                                <td className={`num ${styles.statCell} ${styles.locked}`}>{player.niggling_injuries || 0}</td>

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
                        const isDead = player.dead;
                        const isMNG = player.mng;

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
                                {isTrue(player.is_captain) && <span className={`tag ${styles.miniTag}`} title={t.rules.captain}>C</span>}
                                {mustAdvance(player) && <span className={`tag tag-red ${styles.miniTag}`} title={t.rules.mustAdvanceTitle}>{t.rules.mustAdvance}</span>}
                                {isTrue(player.journeyman) && <span className={`tag ${styles.miniTag}`} title={t.rules.journeyman}>J</span>}
                                {player.hatreds && <span className={styles.hatred}>{t.rules.hatred} ({player.hatreds})</span>}
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

                              <td className={`num ${styles.statCell}`}>{player.ma}</td>
                              <td className={`num ${styles.statCell}`}>{player.st}</td>
                              <td className={`num ${styles.statCell}`}>{player.ag}</td>
                              <td className={`num ${styles.statCell}`}>{player.pa}</td>
                              <td className={`num ${styles.statCell}`}>{player.av}</td>
                              <td className={`num ${styles.statCell} ${styles.sppCell}`}>{player.spp ?? 0}</td>
                              <td className={`num ${styles.statCell}`}>{player.niggling_injuries || ''}</td>

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
                                ) : isTrue(player.temp_retired) ? (
                                    <span className={`tag ${styles.statusTag}`} title={t.rules.tempRetiredTitle}>{t.rules.tempRetired}</span>
                                ) : isMNG ? (
                                    <span className={`tag tag-navy ${styles.statusTag}`}>MNG</span>
                                ) : (
                                    <span className={styles.statusOk} aria-label="Active" />
                                )}
                              </td>

                              {isAdmin && (
                              <td>
                                <div className={styles.rowActions}>
                                  {canLevelUp && !locked && (
                                      <button onClick={() => setLevelUpPlayer(player)} className={`${styles.iconBtn} ${styles.iconLevel}`} title="SPP Advancement" aria-label="SPP Advancement"><ArrowUpCircle size={22} /></button>
                                  )}
                                  {!isDead && !locked && (player.lasting_injuries > 0 || isTrue(player.temp_retired)) && (
                                      <button onClick={() => handleTempRetire(player)} className={styles.iconBtn}
                                              title={isTrue(player.temp_retired) ? t.rules.unretire : t.rules.retire} aria-label={isTrue(player.temp_retired) ? t.rules.unretire : t.rules.retire}>
                                        <span className={styles.trIcon}>{t.rules.tempRetired}</span>
                                      </button>
                                  )}
                                  <button onClick={() => startEditPlayer(player)} className={styles.iconBtn} title="Edit" aria-label="Edit"><Edit2 size={20} /></button>
                                  <button onClick={() => handleDeletePlayer(player.id, player.name)} disabled={locked} className={`${styles.iconBtn} ${styles.iconDanger}`} title={locked ? t.rules.postgameClosed : t.rules.fire} aria-label={t.rules.fire}><Trash2 size={20} /></button>
                                </div>
                              </td>
                              )}
                            </tr>
                        );
                      })}
                      </tbody>
                      <tfoot>
                      <tr>
                        <td colSpan={11} className={styles.right}>{t.rules.tv} · {t.rules.ctv} {team.ctv.toLocaleString()}</td>
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
