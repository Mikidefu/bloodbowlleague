'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './NewTeam.module.css';

export default function NewTeamPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
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
    treasury: 0,
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
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('race', formData.race);
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
        alert('Failed to create team');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating team');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div>
        <div className={styles.headerArea}>
          <h1 className={styles.pageTitle}>{t.draft.title}</h1>
        </div>

        <div className={styles.registrationForm}>
          <form onSubmit={handleSubmit} className={styles.formGrid}>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{t.draft.teamName}</label>
              <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={styles.inputField}
                  placeholder={t.draft.teamNamePlaceholder}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{t.draft.race}</label>
              <select
                  value={formData.race}
                  onChange={(e) => setFormData({...formData, race: e.target.value})}
                  className={styles.selectField}
              >
                {RACES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className={styles.colorGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{t.draft.primaryColor}</label>
                <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                    className={styles.colorPicker}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{t.draft.secondaryColor}</label>
                <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({...formData, secondary_color: e.target.value})}
                    className={styles.colorPicker}
                />
              </div>
            </div>

            {/* Griglia Management Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>REROLLS</label>
                <input type="number" min="0" max="8" value={formData.rerolls} onChange={e => setFormData({...formData, rerolls: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>R. COST</label>
                <input type="number" min="0" step="10000" value={formData.reroll_cost} onChange={e => setFormData({...formData, reroll_cost: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>CHEERLEADERS</label>
                <input type="number" min="0" max="16" value={formData.cheerleaders} onChange={e => setFormData({...formData, cheerleaders: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>COACHES</label>
                <input type="number" min="0" max="16" value={formData.assistant_coaches} onChange={e => setFormData({...formData, assistant_coaches: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>

              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>FANS</label>
                <input type="number" min="0" max="18" value={formData.fan_factor} onChange={e => setFormData({...formData, fan_factor: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>TREASURY</label>
                <input type="number" min="0" step="10000" value={formData.treasury} onChange={e => setFormData({...formData, treasury: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <div className={styles.statInputGroup}>
                <label className={styles.statLabel}>BANK</label>
                <input type="number" min="0" step="10000" value={formData.bank} onChange={e => setFormData({...formData, bank: parseInt(e.target.value) || 0})} className={styles.statInput} />
              </div>
              <label className={styles.apothecaryCheck}>
                <span>MEDIC</span>
                <input type="checkbox" checked={formData.apothecary} onChange={e => setFormData({...formData, apothecary: e.target.checked})} style={{ width: '25px', height: '25px', accentColor: 'var(--color-blood-bright)' }} />
              </label>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>{t.draft.logoUrl}</label>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      style={{ fontFamily: 'var(--font-typewriter)', padding: '0.5rem', border: '3px solid var(--color-ink)' }}
                  />
                  <input
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
                    <div style={{ width: '100px', height: '100px', border: '4px solid var(--color-ink)', flexShrink: 0, padding: '5px', background: '#fff' }}>
                      <img src={logoPreview || formData.logo_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                )}
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button type="button" onClick={() => router.back()} className="btn">CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t.draft.drafting : t.draft.registerBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}