'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Trash2, Plus, Edit2, Save, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './TeamDetails.module.css';

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
        fetchTeam();
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
      fetchTeam();
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

  if (loading || !team) return <div style={{ fontFamily: 'var(--font-typewriter)', fontSize: '1.5rem', textAlign: 'center', marginTop: '4rem' }}>Loading locker room...</div>;

  const staffValue =
      ((team.rerolls || 0) * (team.reroll_cost || 50000)) +
      ((team.cheerleaders || 0) * 10000) +
      ((team.assistant_coaches || 0) * 10000) +
      ((team.fan_factor || 0) * 10000) +
      (team.apothecary ? 50000 : 0);
  const totalValue = team.players.reduce((sum: number, p: any) => sum + p.value, 0) + staffValue;

  return (
      <div>
        {/* DEFINIZIONE FILTRO SVG PER STRAPPARE I BORDI DEL LOGO */}
        <svg style={{ width: 0, height: 0, position: 'absolute' }}>
          <filter id="rough-edges">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        {/* 1. TEAM IDENTITY BANNER (Fascetta) */}
        <div className={styles.teamIdentityBanner}>

          {/* MIGLIORAMENTO: LOGO TOPPA STRAZZATA */}
          <div className={styles.logoSection} style={{ borderLeftColor: team.primary_color }}>
            {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className={styles.teamLogo} />
            ) : (
                <ShieldAlert size={100} color={team.primary_color} className={styles.teamLogo} />
            )}
          </div>

          <div className={styles.infoSection}>
            {/* MIGLIORAMENTO: PULSANTI "RIQUADRINI" (Etichette storte) */}
            <div className={styles.actionGroup}>
              <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={openEditTeam}>
                <Edit2 size={18}/> EDIT
              </button>
              <button className={`${styles.actionBtn} ${styles.disbandBtn}`} onClick={handleDeleteTeam}>
                <Trash2 size={18}/> DISBAND
              </button>
            </div>

            <h1 className={styles.teamName} style={{ textShadow: `4px 4px 0 ${team.secondary_color}` }}>{team.name}</h1>
            <div className={styles.teamRace}>{team.race} &bull; VALUE: {totalValue.toLocaleString()} GP</div>

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

        {/* 2. EDIT TEAM FORM */}
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
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ fontFamily: 'var(--font-typewriter)', padding: '0.5rem', border: '2px solid #ccc' }} />
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
          <h2 className={styles.rosterTitle}>ROSTER ({team.players.length} / 16)</h2>
          {!showPlayerForm && team.players.length < 16 && (
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
                <div className={styles.grid4Col}>
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
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>{t.teamDetail.skills}</label>
                    <input type="text" value={playerForm.skills} onChange={e => setPlayerForm({...playerForm, skills: e.target.value})} className={styles.inputField} placeholder="Block, Dodge" />
                  </div>
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

        {/* TABELLA ROSTER */}
        {team.players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', border: '4px dashed var(--color-ink)', background: 'var(--color-paper)' }}>
              <p style={{ fontFamily: 'var(--font-impact)', fontSize: '2rem', color: '#555' }}>NO PLAYERS HIRED YET</p>
            </div>
        ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.dataTable}>
                <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th className={styles.leftAlign}>{t.teamDetail.thName}</th>
                  <th className={styles.leftAlign}>{t.teamDetail.thRole}</th>
                  <th style={{ width: '50px' }}>{t.teamDetail.thMA}</th>
                  <th style={{ width: '50px' }}>{t.teamDetail.thST}</th>
                  <th style={{ width: '50px' }}>{t.teamDetail.thAG}</th>
                  <th style={{ width: '50px' }}>{t.teamDetail.thPA}</th>
                  <th style={{ width: '50px' }}>{t.teamDetail.thAV}</th>
                  <th style={{ width: '60px' }}>{t.teamDetail.thSPP}</th>
                  <th className={styles.leftAlign}>{t.teamDetail.thSkills}</th>
                  <th>{t.teamDetail.thValue}</th>
                  <th>{t.teamDetail.thStatus}</th>
                  <th>ACT</th>
                </tr>
                </thead>
                <tbody>
                {team.players.map((player: any, index: number) => {

                  // RIGA IN MODALITÀ MODIFICA
                  if (editingPlayerId === player.id) {
                    return (
                        <tr key={player.id} className={styles.editRow}>
                          <td>{index + 1}</td>
                          <td className={styles.leftAlign}>
                            <input type="text" value={editPlayerForm.name} onChange={e => setEditPlayerForm({...editPlayerForm, name: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                          </td>
                          <td className={styles.leftAlign}>
                            <input type="text" value={editPlayerForm.role} onChange={e => setEditPlayerForm({...editPlayerForm, role: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                          </td>
                          <td>
                            <input type="number" value={editPlayerForm.ma} onChange={e => setEditPlayerForm({...editPlayerForm, ma: Number(e.target.value)})} className={styles.editInput} />
                          </td>
                          <td>
                            <input type="number" value={editPlayerForm.st} onChange={e => setEditPlayerForm({...editPlayerForm, st: Number(e.target.value)})} className={styles.editInput} />
                          </td>
                          <td>
                            <input type="text" value={editPlayerForm.ag} onChange={e => setEditPlayerForm({...editPlayerForm, ag: e.target.value})} className={styles.editInput} />
                          </td>
                          <td>
                            <input type="text" value={editPlayerForm.pa} onChange={e => setEditPlayerForm({...editPlayerForm, pa: e.target.value})} className={styles.editInput} />
                          </td>
                          <td>
                            <input type="text" value={editPlayerForm.av} onChange={e => setEditPlayerForm({...editPlayerForm, av: e.target.value})} className={styles.editInput} />
                          </td>
                          <td>
                            <input type="number" value={editPlayerForm.spp} onChange={e => setEditPlayerForm({...editPlayerForm, spp: Number(e.target.value)})} className={styles.editInput} />
                          </td>
                          <td className={styles.leftAlign}>
                            <input type="text" value={editPlayerForm.skills} onChange={e => setEditPlayerForm({...editPlayerForm, skills: e.target.value})} className={`${styles.editInput} ${styles.editInputTxt}`} />
                          </td>
                          <td>
                            <input type="number" value={editPlayerForm.value} onChange={e => setEditPlayerForm({...editPlayerForm, value: Number(e.target.value)})} className={styles.editInput} style={{ width: '100px' }} />
                          </td>
                          <td>
                            <select value={editPlayerForm.status} onChange={e => setEditPlayerForm({...editPlayerForm, status: e.target.value})} className={styles.editInput}>
                              <option value="Active">Active</option>
                              <option value="Injured">Injured</option>
                              <option value="Dead">Dead</option>
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button onClick={() => handleSavePlayerEdit(player.id)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', padding: '0.5rem', cursor: 'pointer' }}><Save size={18} /></button>
                              <button onClick={() => setEditingPlayerId(null)} style={{ background: 'transparent', color: 'var(--color-blood-bright)', border: '2px solid var(--color-blood-bright)', padding: '0.3rem', cursor: 'pointer' }}><X size={18} /></button>
                            </div>
                          </td>
                        </tr>
                    );
                  }

                  // RIGA STANDARD
                  const statusClass = player.status === 'Active' ? styles.statusActive : player.status === 'Injured' ? styles.statusInjured : styles.statusDead;

                  return (
                      <tr key={player.id}>
                        <td>{index + 1}</td>
                        <td className={`${styles.leftAlign} ${styles.playerName}`}>{player.name}</td>
                        <td className={`${styles.leftAlign} ${styles.playerRole}`}>{player.role}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.ma ?? 6}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.st ?? 3}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.ag ?? '3+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.pa ?? '4+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.4rem' }}>{player.av ?? '8+'}</td>
                        <td style={{ fontFamily: 'var(--font-impact)', fontSize: '1.5rem', color: 'var(--color-blood-bright)' }}>{player.spp ?? 0}</td>
                        <td className={styles.leftAlign}>
                          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                            {player.skills.map((s: string, i: number) => (
                                <span key={i} className={styles.playerSkill}>{s}</span>
                            ))}
                          </div>
                        </td>
                        <td>{player.value.toLocaleString()}</td>
                        <td>
                      <span className={statusClass} style={{ fontFamily: 'var(--font-impact)', fontSize: '1.1rem' }}>
                        {player.status}
                      </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button onClick={() => startEditPlayer(player)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }} title="Edit"><Edit2 size={20} /></button>
                            <button onClick={() => handleDeletePlayer(player.id, player.name)} style={{ background: 'none', border: 'none', color: 'var(--color-blood-bright)', cursor: 'pointer' }} title="Fire"><Trash2 size={20} /></button>
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