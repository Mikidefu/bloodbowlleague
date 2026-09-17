'use client';
import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import Emblem from '@/components/brand/Emblem';
import styles from './Login.module.css';

export default function LoginPage() {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        // Ricarica completa così la navbar e le pagine vedono subito la sessione
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/';
        return;
      }
      setError(res.status === 401 ? t.auth.wrongPassword : t.auth.loginError);
    } catch {
      setError(t.auth.loginError);
    }
    setSubmitting(false);
  };

  return (
      <div>
        <PageHeader title={t.auth.title} icon={<Lock size={44} />} tone="slate" />

        <div className={`card ${styles.loginCard}`}>
          <Emblem size={110} className={styles.emblem} />
          <p className={styles.subtitle}>{t.auth.subtitle}</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="admin-password" className={styles.label}>{t.auth.password}</label>
            <input
                id="admin-password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={styles.input}
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={`btn btn-primary ${styles.submit}`} disabled={submitting}>
              {submitting ? '...' : t.auth.loginBtn}
            </button>
          </form>
        </div>
      </div>
  );
}
