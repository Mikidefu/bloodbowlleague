'use client';
// Come mettere la companion sulla schermata Home: su Android col prompt del browser, su iPhone a mano
// (Safari non ha un prompt: Condividi -> Aggiungi alla schermata Home). Già installata: non si mostra niente.

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Companion.module.css';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallHint() {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [mode, setMode] = useState<'hidden' | 'ios' | 'prompt'>('hidden');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il sistema operativo si conosce solo nel browser
    if (ios) setMode('ios');
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); setMode('prompt'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (mode === 'hidden') return null;
  return (
      <aside className={styles.install}>
        {mode === 'prompt' && prompt ? (
            <button type="button" className={`btn ${styles.wide}`} onClick={async () => { await prompt.prompt(); await prompt.userChoice; setMode('hidden'); }}>
              <Download size={18} /> {L('Installa la companion sul telefono', 'Install the companion on your phone')}
            </button>
        ) : (
            <p>{L('Per averla come un’app: in Safari tocca Condividi, poi “Aggiungi alla schermata Home”.', 'To use it like an app: in Safari tap Share, then “Add to Home Screen”.')}</p>
        )}
      </aside>
  );
}
