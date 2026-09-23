'use client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Companion.module.css';

/** IT / EN: nella companion non c'è la barra del sito, la lingua si cambia qui. */
export default function LangSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
      <div className={styles.lang} role="group" aria-label="Language">
        {(['it', 'en'] as const).map(l => (
            <button key={l} type="button" aria-pressed={language === l} onClick={() => setLanguage(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
  );
}
