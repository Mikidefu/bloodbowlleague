'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Trash2, Plus, Edit2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TeamDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useLanguage();
  
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
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

  // Player form
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerForm, setEditPlayerForm] = useState({
    name: '', role: '', value: 0, skills: '', status: 'Active',
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0
  });

  const [playerForm, setPlayerForm] = useState({
    name: '', role: 'Lineman', value: 50000, skills: '',
    ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0
  });

  const fetchTeam = () => {
    fetch(`/api/teams/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setTeam(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        router.push('/teams');
      });
  };

  useEffect(() => {
    fetchTeam();
  }, [id]);

  const handleDeleteTeam = async () => {
    if (!confirm(t.teamDetail.confirmDisband.replace('{teamName}', team.name))) return;
    try {
      await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      router.push('/teams');
    } catch (e) {
      alert('Failed to delete team');
    }
  };

  const openEditTeam = () => {
    setEditForm({
      name: team.name, 
      primary_color: team.primary_color, 
      secondary_color: team.secondary_color, 
      logo_url: team.logo_url || '',
      rerolls: team.rerolls || 0,
      reroll_cost: team.reroll_cost || 50000,
      cheerleaders: team.cheerleaders || 0,
      assistant_coaches: team.assistant_coaches || 0,
      fan_factor: team.fan_factor || 0,
      apothecary: team.apothecary === 1 || team.apothecary === true,
      treasury: team.treasury || 0,
      bank: team.bank || 0
    });
    setLogoFile(null);
    setLogoPreview(null);
    setShowEditTeam(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setEditForm({ ...editForm, logo_url: '' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingTeam(true);

    try {
      const submitData = new FormData();
      submitData.append('name', editForm.name);
      submitData.append('primary_color', editForm.primary_color);
      submitData.append('secondary_color', editForm.secondary_color);
      submitData.append('rerolls', editForm.rerolls.toString());
      submitData.append('reroll_cost', editForm.reroll_cost.toString());
      submitData.append('cheerleaders', editForm.cheerleaders.toString());
      submitData.append('assistant_coaches', editForm.assistant_coaches.toString());
      submitData.append('fan_factor', editForm.fan_factor.toString());
      submitData.append('apothecary', editForm.apothecary.toString());
      submitData.append('treasury', editForm.treasury.toString());
      submitData.append('bank', editForm.bank.toString());
      
      if (logoFile) {
        submitData.append('logo_file', logoFile);
      } else if (editForm.logo_url) {
        submitData.append('logo_url', editForm.logo_url);
      } else {
        submitData.append('logo_url', '');
      }

      const res = await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        body: submitData
      });
      
      if (res.ok) {
        setShowEditTeam(false);
        fetchTeam();
      } else {
        alert('Failed to update team');
      }
    } catch (err) {
      alert('Error updating team');
    } finally {
      setIsEditingTeam(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Parse skills from comma-separated string
    const skillsArray = playerForm.skills.split(',').map(s => s.trim()).filter(s => s);

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: id,
          name: playerForm.name,
          role: playerForm.role,
          value: Number(playerForm.value),
          skills: skillsArray,
          ma: Number(playerForm.ma),
          st: Number(playerForm.st),
          ag: playerForm.ag,
          pa: playerForm.pa,
          av: playerForm.av,
          spp: Number(playerForm.spp)
        })
      });
      
      if (res.ok) {
        setPlayerForm({ name: '', role: 'Lineman', value: 50000, skills: '', ma: 6, st: 3, ag: '3+', pa: '4+', av: '8+', spp: 0 });
        setShowPlayerForm(false);
        fetchTeam(); // Refresh roster
      } else {
        alert('Failed to hire player');
      }
    } catch (e) {
      alert('Error hiring player');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!confirm(t.teamDetail.confirmFire.replace('{playerName}', name))) return;
    try {
      await fetch(`/api/players/${playerId}`, { method: 'DELETE' });
      fetchTeam(); // Refresh
    } catch (e) {
      alert('Failed to fire player');
    }
  };

  const startEditPlayer = (player: any) => {
    setEditingPlayerId(player.id);
    setEditPlayerForm({
      name: player.name,
      role: player.role,
      value: player.value,
      skills: Array.isArray(player.skills) ? player.skills.join(', ') : '',
      status: player.status || 'Active',
      ma: player.ma ?? 6,
      st: player.st ?? 3,
      ag: player.ag ?? '3+',
      pa: player.pa ?? '4+',
      av: player.av ?? '8+',
      spp: player.spp ?? 0
    });
  };

  const handleSavePlayerEdit = async (playerId: string) => {
    const skillsArray = editPlayerForm.skills.split(',').map(s => s.trim()).filter(s => s);
    
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPlayerForm.name,
          role: editPlayerForm.role,
          value: Number(editPlayerForm.value),
          status: editPlayerForm.status,
          skills: skillsArray,
          ma: Number(editPlayerForm.ma),
          st: Number(editPlayerForm.st),
          ag: editPlayerForm.ag,
          pa: editPlayerForm.pa,
          av: editPlayerForm.av,
          spp: Number(editPlayerForm.spp)
        })
      });
      
      if (res.ok) {
        setEditingPlayerId(null);
        fetchTeam();
      } else {
        alert('Failed to update player');
      }
    } catch (e) {
      alert('Error updating player');
    }
  };

  if (loading || !team) return <div>Loading locker room...</div>;

  const staffValue = 
    ((team.rerolls || 0) * (team.reroll_cost || 50000)) + 
    ((team.cheerleaders || 0) * 10000) + 
    ((team.assistant_coaches || 0) * 10000) + 
    ((team.fan_factor || 0) * 10000) + 
    (team.apothecary ? 50000 : 0);
  const totalValue = team.players.reduce((sum: number, p: any) => sum + p.value, 0) + staffValue;

  return (
    <div>
      {/* Team Header */}
      <div className="card" style={{ marginBottom: '2rem', borderTop: `4px solid ${team.primary_color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', background: 'var(--color-black)', border: `2px solid ${team.secondary_color}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={64} color={team.primary_color} />
              </div>
            )}
            <div>
              <h1 style={{ fontSize: '4rem', margin: 0, textShadow: `2px 2px 0 ${team.secondary_color}` }}>{team.name}</h1>
              <p style={{ fontSize: '1.5rem', color: 'var(--color-steel-light)', fontFamily: 'var(--font-varsity)' }}>
                {team.race} &bull; {t.teamDetail.teamValue}: {totalValue.toLocaleString()} GP
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <span className="badge">Rerolls: {team.rerolls || 0}</span>
                <span className="badge">Cheerleaders: {team.cheerleaders || 0}</span>
                <span className="badge">Asst. Coaches: {team.assistant_coaches || 0}</span>
                <span className="badge">Fan Factor: {team.fan_factor || 0}</span>
                <span className="badge">Apothecary: {team.apothecary ? 'Yes' : 'No'}</span>
                <span className="badge" style={{ color: 'var(--color-gold)' }}>Treasury: {(team.treasury || 0).toLocaleString()} GP</span>
                <span className="badge" style={{ color: 'var(--color-gold)' }}>Bank: {(team.bank || 0).toLocaleString()} GP</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button className="btn" onClick={openEditTeam} style={{ borderColor: 'var(--color-steel)', color: 'var(--color-bone)', width: '100%', justifyContent: 'center' }}>
              <Edit2 size={20} /> {t.teamDetail.editTeamBtn}
            </button>
            <button className="btn" style={{ borderColor: 'var(--color-blood-red)', color: 'var(--color-blood-bright)', width: '100%', justifyContent: 'center' }} onClick={handleDeleteTeam}>
              <Trash2 size={20} /> {t.teamDetail.disband}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Team Form */}
      {showEditTeam && (
        <div className="card" style={{ marginBottom: '2rem', borderStyle: 'dashed' }}>
          <h3>{t.teamDetail.editTeamTitle}</h3>
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.name}</label>
                <input type="text" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.draft.primaryColor}</label>
                <input type="color" value={editForm.primary_color} onChange={e => setEditForm({...editForm, primary_color: e.target.value})} style={{ width: '100%', height: '45px', background: 'var(--color-black)', border: '1px solid var(--color-mud)', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.draft.secondaryColor}</label>
                <input type="color" value={editForm.secondary_color} onChange={e => setEditForm({...editForm, secondary_color: e.target.value})} style={{ width: '100%', height: '45px', background: 'var(--color-black)', border: '1px solid var(--color-mud)', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', background: '#1a1a1a', padding: '1rem', borderRadius: '4px', border: '1px solid var(--color-mud)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.rerolls}</label>
                <input type="number" min="0" max="8" value={editForm.rerolls} onChange={e => setEditForm({...editForm, rerolls: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.rerollCost}</label>
                <input type="number" min="0" step="10000" value={editForm.reroll_cost} onChange={e => setEditForm({...editForm, reroll_cost: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.cheerleaders}</label>
                <input type="number" min="0" max="16" value={editForm.cheerleaders} onChange={e => setEditForm({...editForm, cheerleaders: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.assistantCoaches}</label>
                <input type="number" min="0" max="16" value={editForm.assistant_coaches} onChange={e => setEditForm({...editForm, assistant_coaches: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.fanFactor}</label>
                <input type="number" min="0" max="18" value={editForm.fan_factor} onChange={e => setEditForm({...editForm, fan_factor: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.treasury}</label>
                <input type="number" min="0" step="10000" value={editForm.treasury} onChange={e => setEditForm({...editForm, treasury: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.bank}</label>
                <input type="number" min="0" step="10000" value={editForm.bank} onChange={e => setEditForm({...editForm, bank: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-bone)', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={editForm.apothecary} onChange={e => setEditForm({...editForm, apothecary: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                  {t.teamDetail.apothecary}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.draft.logoUrl}</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem', fontSize: '0.9rem', borderRadius: '4px' }} />
                  <span style={{ color: 'var(--color-steel-light)', fontSize: '0.8rem' }}>OR</span>
                  <input type="url" value={editForm.logo_url} onChange={(e) => { setEditForm({...editForm, logo_url: e.target.value}); setLogoFile(null); setLogoPreview(null); }} style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px' }} placeholder="https://..." />
                </div>
                
                {(logoPreview || editForm.logo_url) && (
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-mud)', flexShrink: 0 }}>
                    <img src={logoPreview || editForm.logo_url} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setShowEditTeam(false)} style={{ borderColor: 'var(--color-steel)' }}>{t.teamDetail.cancel}</button>
              <button type="submit" className="btn btn-primary" disabled={isEditingTeam}>
                {isEditingTeam ? t.draft.drafting : t.teamDetail.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{t.teamDetail.roster} ({team.players.length} / 16)</h2>
        {!showPlayerForm && team.players.length < 16 && (
          <button className="btn btn-primary" onClick={() => setShowPlayerForm(true)}>
            <Plus size={20} /> {t.teamDetail.hirePlayer}
          </button>
        )}
      </div>

      {/* Add Player Form */}
      {showPlayerForm && (
        <div className="card" style={{ marginBottom: '2rem', borderStyle: 'dashed' }}>
          <h3>{t.teamDetail.hireNewPlayerTitle}</h3>
          <form onSubmit={handleAddPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr 1fr 2fr', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.name}</label>
                <input type="text" required value={playerForm.name} onChange={e => setPlayerForm({...playerForm, name: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} placeholder="Player Name" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.role}</label>
                <input type="text" required value={playerForm.role} onChange={e => setPlayerForm({...playerForm, role: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} placeholder="e.g. Blitzer" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.value}</label>
                <input type="number" required value={playerForm.value} onChange={e => setPlayerForm({...playerForm, value: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.skills}</label>
                <input type="text" value={playerForm.skills} onChange={e => setPlayerForm({...playerForm, skills: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} placeholder="Block, Dodge" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', background: '#1a1a1a', padding: '1rem', borderRadius: '4px', border: '1px solid var(--color-mud)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thMA}</label>
                <input type="number" required value={playerForm.ma} onChange={e => setPlayerForm({...playerForm, ma: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thST}</label>
                <input type="number" required value={playerForm.st} onChange={e => setPlayerForm({...playerForm, st: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thAG}</label>
                <input type="text" required value={playerForm.ag} onChange={e => setPlayerForm({...playerForm, ag: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} placeholder="3+" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thPA}</label>
                <input type="text" required value={playerForm.pa} onChange={e => setPlayerForm({...playerForm, pa: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} placeholder="4+" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thAV}</label>
                <input type="text" required value={playerForm.av} onChange={e => setPlayerForm({...playerForm, av: e.target.value})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} placeholder="8+" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-steel-light)', textAlign: 'center' }}>{t.teamDetail.thSPP}</label>
                <input type="number" required value={playerForm.spp} onChange={e => setPlayerForm({...playerForm, spp: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', textAlign: 'center' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{t.teamDetail.hireBtn}</button>
              <button type="button" className="btn" onClick={() => setShowPlayerForm(false)}>{t.teamDetail.cancel}</button>
            </div>
          </form>
        </div>
      )}

      {/* Roster Table */}
      {team.players.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-steel-light)', fontSize: '1.2rem' }}>{t.teamDetail.noPlayersText}</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '30px' }}>#</th>
              <th>{t.teamDetail.thName}</th>
              <th>{t.teamDetail.thRole}</th>
              <th style={{ width: '40px', textAlign: 'center' }} title="Movement Allowance">{t.teamDetail.thMA}</th>
              <th style={{ width: '40px', textAlign: 'center' }} title="Strength">{t.teamDetail.thST}</th>
              <th style={{ width: '40px', textAlign: 'center' }} title="Agility">{t.teamDetail.thAG}</th>
              <th style={{ width: '40px', textAlign: 'center' }} title="Passing Ability">{t.teamDetail.thPA}</th>
              <th style={{ width: '40px', textAlign: 'center' }} title="Armour Value">{t.teamDetail.thAV}</th>
              <th style={{ width: '50px', textAlign: 'center' }} title="Star Player Points">{t.teamDetail.thSPP}</th>
              <th>{t.teamDetail.thSkills}</th>
              <th>{t.teamDetail.thValue}</th>
              <th>{t.teamDetail.thStatus}</th>
              <th style={{ textAlign: 'right' }}>{t.teamDetail.thActions}</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((player: any, index: number) => {
              if (editingPlayerId === player.id) {
                return (
                  <tr key={player.id} style={{ background: 'var(--color-black)' }}>
                    <td style={{ fontWeight: 'bold', color: 'var(--color-steel-light)' }}>{index + 1}</td>
                    <td>
                      <input type="text" value={editPlayerForm.name} onChange={e => setEditPlayerForm({...editPlayerForm, name: e.target.value})} style={{ width: '100px', padding: '0.2rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} />
                    </td>
                    <td>
                      <input type="text" value={editPlayerForm.role} onChange={e => setEditPlayerForm({...editPlayerForm, role: e.target.value})} style={{ width: '80px', padding: '0.2rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" value={editPlayerForm.ma} onChange={e => setEditPlayerForm({...editPlayerForm, ma: Number(e.target.value)})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" value={editPlayerForm.st} onChange={e => setEditPlayerForm({...editPlayerForm, st: Number(e.target.value)})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="text" value={editPlayerForm.ag} onChange={e => setEditPlayerForm({...editPlayerForm, ag: e.target.value})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="text" value={editPlayerForm.pa} onChange={e => setEditPlayerForm({...editPlayerForm, pa: e.target.value})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="text" value={editPlayerForm.av} onChange={e => setEditPlayerForm({...editPlayerForm, av: e.target.value})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" value={editPlayerForm.spp} onChange={e => setEditPlayerForm({...editPlayerForm, spp: Number(e.target.value)})} style={{ width: '60px', padding: '0.5rem', textAlign: 'center', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', fontSize: '1.1rem', borderRadius: '4px' }} />
                    </td>
                    <td>
                      <input type="text" value={editPlayerForm.skills} onChange={e => setEditPlayerForm({...editPlayerForm, skills: e.target.value})} style={{ width: '120px', padding: '0.5rem', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', borderRadius: '4px' }} placeholder="Block, Dodge" />
                    </td>
                    <td>
                      <input type="number" value={editPlayerForm.value} onChange={e => setEditPlayerForm({...editPlayerForm, value: Number(e.target.value)})} style={{ width: '100px', padding: '0.5rem', background: '#111', border: '1px solid var(--color-glass-border)', color: 'var(--color-bone)', borderRadius: '4px' }} />
                    </td>
                    <td>
                      <select value={editPlayerForm.status} onChange={e => setEditPlayerForm({...editPlayerForm, status: e.target.value})} style={{ padding: '0.2rem', background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', width: '80px' }}>
                        <option value="Active">Active</option>
                        <option value="Injured">Injured</option>
                        <option value="Dead">Dead</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={() => handleSavePlayerEdit(player.id)} style={{ padding: '0 0.5rem', background: 'var(--color-grass)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', height: '24px' }}>Save</button>
                      <button onClick={() => setEditingPlayerId(null)} style={{ padding: '0 0.5rem', background: 'var(--color-mud)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', height: '24px' }}>Cancel</button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={player.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--color-steel-light)' }}>{index + 1}</td>
                  <td style={{ fontWeight: 'bold' }}>{player.name}</td>
                  <td>{player.role}</td>
                  <td style={{ textAlign: 'center' }}>{player.ma ?? 6}</td>
                  <td style={{ textAlign: 'center' }}>{player.st ?? 3}</td>
                  <td style={{ textAlign: 'center' }}>{player.ag ?? '3+'}</td>
                  <td style={{ textAlign: 'center' }}>{player.pa ?? '4+'}</td>
                  <td style={{ textAlign: 'center' }}>{player.av ?? '8+'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-gold)' }}>{player.spp ?? 0}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {player.skills.map((s: string, i: number) => (
                        <span key={i} style={{ fontSize: '0.8rem', background: 'var(--color-mud)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td>{player.value.toLocaleString()}</td>
                  <td>
                    <span style={{ 
                      color: player.status === 'Active' ? 'var(--color-grass-light)' : 
                             player.status === 'Injured' ? 'orange' : 'var(--color-blood-bright)',
                      fontWeight: 'bold', textTransform: 'uppercase'
                    }}>
                      {player.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button 
                      onClick={() => startEditPlayer(player)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Edit Player"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeletePlayer(player.id, player.name)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-steel)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Fire Player"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
