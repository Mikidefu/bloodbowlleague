'use client';
// Se qualcosa nella companion va storto a metà partita non deve restare uno schermo bianco:
// la squadra resta collegata (sessione e tocchi in coda stanno sul telefono), basta riprovare.

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Companion.module.css';

export default function CompanionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);

  useEffect(() => { console.error(error); }, [error]);

  return (
      <div className={styles.app}>
        <section className={styles.panel} role="alert">
          <h1 className={styles.title}>{L('Qualcosa è andato storto', 'Something went wrong')}</h1>
          <p className={styles.help}>{L('La partita non è persa: il telefono resta collegato alla squadra e i tocchi non ancora inviati sono salvati.', 'The match is not lost: the phone stays paired with the team and any taps not yet sent are saved.')}</p>
          <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={() => retry()}>
            <RotateCcw size={18} /> {L('Riprova', 'Try again')}
          </button>
          <button type="button" className={`btn ${styles.wide}`} onClick={() => window.location.reload()}>{L('Ricarica la pagina', 'Reload the page')}</button>
        </section>
      </div>
  );
}
