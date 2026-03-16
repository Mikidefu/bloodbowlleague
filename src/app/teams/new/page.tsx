'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

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
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem', textAlign: 'center', borderBottom: '2px solid var(--color-blood-red)', paddingBottom: '1rem' }}>
        {t.draft.title}
      </h1>
      
      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.25rem', color: 'var(--color-steel-light)' }}>{t.draft.teamName}</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px' }}
              placeholder={t.draft.teamNamePlaceholder}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.25rem', color: 'var(--color-steel-light)' }}>{t.draft.race}</label>
            <select 
              value={formData.race}
              onChange={(e) => setFormData({...formData, race: e.target.value})}
              style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px' }}
            >
              {RACES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.25rem', color: 'var(--color-steel-light)' }}>{t.draft.primaryColor}</label>
              <input 
                type="color" 
                value={formData.primary_color}
                onChange={(e) => setFormData({...formData, primary_color: e.target.value})}
                style={{ width: '100%', height: '50px', background: 'var(--color-black)', border: '1px solid var(--color-mud)', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.25rem', color: 'var(--color-steel-light)' }}>{t.draft.secondaryColor}</label>
              <input 
                type="color" 
                value={formData.secondary_color}
                onChange={(e) => setFormData({...formData, secondary_color: e.target.value})}
                style={{ width: '100%', height: '50px', background: 'var(--color-black)', border: '1px solid var(--color-mud)', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontFamily: 'var(--font-varsity)', fontSize: '1.25rem', color: 'var(--color-steel-light)' }}>{t.draft.logoUrl}</label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px' }}
                />
                <span style={{ color: 'var(--color-steel-light)', fontSize: '0.9rem', textAlign: 'center' }}>OR</span>
                <input 
                  type="url" 
                  value={formData.logo_url}
                  onChange={(e) => {
                    setFormData({...formData, logo_url: e.target.value});
                    setLogoFile(null);
                    setLogoPreview(null);
                  }}
                  style={{ background: 'var(--color-black)', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.75rem', fontSize: '1rem', borderRadius: '4px' }}
                  placeholder="https://..."
                />
              </div>
              
              {(logoPreview || formData.logo_url) && (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--color-mud)', flexShrink: 0 }}>
                  <img src={logoPreview || formData.logo_url} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--color-black)', padding: '1rem', borderRadius: '4px', border: '1px solid var(--color-mud)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.rerolls}</label>
              <input type="number" min="0" max="8" value={formData.rerolls} onChange={e => setFormData({...formData, rerolls: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.rerollCost}</label>
              <input type="number" min="0" step="10000" value={formData.reroll_cost} onChange={e => setFormData({...formData, reroll_cost: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.cheerleaders}</label>
              <input type="number" min="0" max="16" value={formData.cheerleaders} onChange={e => setFormData({...formData, cheerleaders: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.assistantCoaches}</label>
              <input type="number" min="0" max="16" value={formData.assistant_coaches} onChange={e => setFormData({...formData, assistant_coaches: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.fanFactor}</label>
              <input type="number" min="0" max="18" value={formData.fan_factor} onChange={e => setFormData({...formData, fan_factor: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.treasury}</label>
              <input type="number" min="0" step="10000" value={formData.treasury} onChange={e => setFormData({...formData, treasury: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--color-steel-light)' }}>{t.teamDetail.bank}</label>
              <input type="number" min="0" step="10000" value={formData.bank} onChange={e => setFormData({...formData, bank: parseInt(e.target.value) || 0})} style={{ background: '#111', border: '1px solid var(--color-mud)', color: 'var(--color-bone)', padding: '0.5rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-bone)' }}>
                <input type="checkbox" checked={formData.apothecary} onChange={e => setFormData({...formData, apothecary: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                {t.teamDetail.apothecary}
              </label>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => router.back()} className="btn" style={{ borderColor: 'var(--color-steel)', color: 'var(--color-bone)' }}>{t.draft.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t.draft.drafting : t.draft.registerBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
