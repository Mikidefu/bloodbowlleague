'use client';
import { useState } from 'react';
import { Lock, KeyRound, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import PageHeader from '@/components/brand/PageHeader';
import Emblem from '@/components/brand/Emblem';
import Shards from '@/components/brand/Shards';
import TapeStrip from '@/components/brand/TapeStrip';
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

        <section className={styles.stage}>
          <div className={styles.tape}>
            <TapeStrip tone="mustard" angle={-2} fit items={['Authorized staff only', 'Locker room']} />
          </div>

          <div className={`offset-frame ${styles.frame}`}>
            <div className={styles.panel}>
              <div className={styles.side}>
                <Shards variant="band" className={styles.sideShards} />
                <span className={styles.sideIndex} aria-hidden="true">00</span>
                <span className={styles.micro}>
                  <i className={styles.microSquares} aria-hidden="true" />
                  BBL // Commissioner access
                </span>
                <Emblem size={150} className={styles.emblem} />
                <p className={styles.subtitle}>{t.auth.subtitle}</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <span className={styles.formMicro}>
                  <Lock size={14} aria-hidden="true" /> Secure login
                </span>
                <h2 className={styles.formTitle}>{t.auth.title}</h2>

                <label htmlFor="admin-password" className={styles.label}>{t.auth.password}</label>
                <div className={styles.inputWrap}>
                  <KeyRound size={18} className={styles.inputIcon} aria-hidden="true" />
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
                </div>
                {error && <p className={styles.error} role="alert">{error}</p>}
                <button type="submit" className={styles.submit} disabled={submitting}>
                  <span>{submitting ? '...' : t.auth.loginBtn}</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
  );
}
