'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/brand/PageHeader';
import styles from './NewTeam.module.css';
import CoachPicker, { coachChoicePayload, emptyCoachChoice, isCoachChoiceComplete } from '@/components/CoachPicker';
import { useSeason } from '@/lib/SeasonContext';
import type { Coach } from '@/lib/types';

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
    race: 'Amazons',
    primary_color: '#2d4a22',
    secondary_color: '#8b0000',
    logo_url: '',
    rerolls: 0,
    reroll_cost: 50000,
    cheerleaders: 0,
    assistant_coaches: 0,
    fan_factor: 0,
    apothecary: false,
    treasury: 1000000, // budget iniziale standard
    bank: 0
  });

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

  const RACES = [
    'Amazons', 'Black Orcs', 'Bretonnian', 'Chaos Chosen', 'Chaos Dwarves',
    'Chaos Renegades', 'Dark Elf', 'Dwarves', 'Elf Union', 'Gnomes',
    'Goblins', 'Halflings', 'High Elves', 'Humans', 'Imperial Nobility',
    'Khorne', 'Lizardmen', 'Necromantics', 'Norse', 'Nurgle', 'Ogre',
    'Old World Alliance', 'Orcs', 'Shambling Undead', 'Skaven', 'Slanns',
    'Snotlings', 'Tomb Kings', 'Underworlds Denizens', 'Vampires', 'Wood Elves'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCoachChoiceComplete(coachChoice)) {
      alert(t.coachPicker.choose);
      return;
    }
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('race', formData.race);
      for (const [key, value] of Object.entries(coachChoicePayload(coachChoice))) {
        if (value) submitData.append(key, value);
      }
      submitData.append('primary_color', formData.primary_color);
      submitData.append('secondary_color', formData.secondary_color);
      submitData.append('rerolls', formData.rerolls.toString());
      submitData.append('reroll_cost', formData.reroll_cost.toString());
      submitData.append('cheerleaders', formData.cheerleaders.toString());
      submitData.append('assistant_coaches', formData.assistant_coaches.toString());
      submitData.append('fan_factor', formData.fan_factor.toString());
      submitData.append('apothecary', formData.apothecary.toString());
      submitData.append('treasury', formData.treasury.toString());
      submitData.append('bank', formData.bank.toString());

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

  return (
      <div>
        <PageHeader
            title={t.draft.title}
            icon={<Plus size={44} />}
            subtitle={activeSeason ? `${t.seasons.season}: ${activeSeason.name}` : undefined}
        />

        <form onSubmit={handleSubmit} className={styles.form}>

          {/* IDENTITÀ */}
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
                <label htmlFor="team-race" className={styles.label}>{t.draft.race}</label>
                <select
                    id="team-race"
                    value={formData.race}
                    onChange={(e) => setFormData({...formData, race: e.target.value})}
                    className={styles.inputField}
                >
                  {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

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

          {/* GESTIONE */}
          <section className={`card ${styles.section}`}>
            <h2 className="subhead">Management</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-rerolls" className={styles.statLabel}>REROLLS</label>
                <input id="stat-rerolls" type="number" min="0" max="8" value={formData.rerolls} onChange={e => setFormData({...formData, rerolls: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-reroll-cost" className={styles.statLabel}>R. COST</label>
                <input id="stat-reroll-cost" type="number" min="0" step="10000" value={formData.reroll_cost} onChange={e => setFormData({...formData, reroll_cost: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-cheerleaders" className={styles.statLabel}>CHEERLEADERS</label>
                <input id="stat-cheerleaders" type="number" min="0" max="16" value={formData.cheerleaders} onChange={e => setFormData({...formData, cheerleaders: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-coaches" className={styles.statLabel}>ASST. COACHES</label>
                <input id="stat-coaches" type="number" min="0" max="16" value={formData.assistant_coaches} onChange={e => setFormData({...formData, assistant_coaches: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>

              <div className={styles.statInputGroup}>
                <label htmlFor="stat-fans" className={styles.statLabel}>FANS</label>
                <input id="stat-fans" type="number" min="0" max="18" value={formData.fan_factor} onChange={e => setFormData({...formData, fan_factor: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-treasury" className={styles.statLabel}>TREASURY</label>
                <input id="stat-treasury" type="number" min="0" step="10000" value={formData.treasury} onChange={e => setFormData({...formData, treasury: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label htmlFor="stat-bank" className={styles.statLabel}>BANK</label>
                <input id="stat-bank" type="number" min="0" step="10000" value={formData.bank} onChange={e => setFormData({...formData, bank: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <label className={styles.apothecaryCheck}>
                <span className={styles.statLabel}>MEDIC</span>
                <input type="checkbox" checked={formData.apothecary} onChange={e => setFormData({...formData, apothecary: e.target.checked})} className={styles.checkbox} />
              </label>
            </div>
          </section>

          <div className={styles.actionButtons}>
            <button type="button" onClick={() => router.back()} className="btn">CANCEL</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.draft.drafting : t.draft.registerBtn}
            </button>
          </div>
        </form>
      </div>
  );
}
