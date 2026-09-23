'use client';
// Ingresso della companion app: codice della partita (digitato o dal QR), scelta della squadra.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, Shield, Smartphone } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { clearSession, deviceId, readSession, saveSession, type CompanionSession } from '@/lib/live/companionSession';
import Emblem from '@/components/brand/Emblem';
import InstallHint from './InstallHint';
import LangSwitch from './LangSwitch';
import styles from './Companion.module.css';

type Lookup = { match_id: string; round: number; teams: { id: string; name: string; color: string | null; logo: string | null; paired: boolean; mine: boolean }[] };

// Gli errori si salvano come tipo e si traducono al render: cambiando lingua si traducono subito
type JoinError = { kind: 'not_found' | 'offline' | 'taken' } | { kind: 'server'; message: string };

const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export default function CompanionJoin() {
  const router = useRouter();
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  const [session, setSession] = useState<CompanionSession | null>(null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Lookup | null>(null);
  const [error, setError] = useState<JoinError | null>(null);
  const [notice, setNotice] = useState<'unpaired' | 'ended' | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (value: string) => {
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const res = await fetch(`/api/live/join?code=${encodeURIComponent(value)}&device=${encodeURIComponent(deviceId())}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setFound(json);
      else setError(res.status === 404 ? { kind: 'not_found' } : { kind: 'server', message: json.error ?? `HTTP ${res.status}` });
    } catch {
      setError({ kind: 'offline' });
    } finally {
      setBusy(false);
    }
  }, []);

  // Il QR apre /companion?code=XXXXXX; ?msg=unpaired|ended arriva dal tabellone quando il telefono esce dalla partita
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQr = clean(params.get('code') ?? '');
    const msg = params.get('msg');
    setSession(readSession());
    if (msg === 'unpaired' || msg === 'ended') setNotice(msg);
    if (fromQr.length === 6) { setCode(fromQr); void lookup(fromQr); }
  }, [lookup]);

  const join = async (teamId: string) => {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/live/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, team_id: teamId, device_id: deviceId() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 409 ? { kind: 'taken' } : { kind: 'server', message: json.error ?? `HTTP ${res.status}` });
        void lookup(code);
        return;
      }
      saveSession({ match_id: json.match_id, team_id: json.team_id, token: json.token, code });
      router.push(`/companion/${json.match_id}`);
    } catch {
      setError({ kind: 'offline' });
    } finally {
      setBusy(false);
    }
  };

  const errorText = !error ? null
    : error.kind === 'not_found' ? L('Nessuna partita dal vivo con questo codice. Controlla il codice sulla pagina della partita.', 'No live match with this code. Check the code on the match page.')
    : error.kind === 'offline' ? L('Senza rete: riprova quando sei connesso.', 'Offline: try again when you are connected.')
    : error.kind === 'taken' ? L('Questa squadra è già collegata a un altro telefono. Chiedi all’admin di scollegarlo.', 'This team is already paired with another phone. Ask the admin to disconnect it.')
    : 'message' in error ? error.message : '';

  return (
      <div className={styles.app}>
        <header className={styles.brand}>
          <Emblem size={48} />
          <div className={styles.brandText}>
            <strong className="title-spike">Companion</strong>
            <span>Blood Bowl League</span>
          </div>
          <LangSwitch />
        </header>

        {notice === 'unpaired' && <p className={styles.notice}>{L('Questo telefono è stato scollegato dalla partita. Inserisci di nuovo il codice per ricollegarti.', 'This phone was disconnected from the match. Enter the code again to reconnect.')}</p>}
        {notice === 'ended' && <p className={styles.notice}>{L('La partita è stata chiusa. Grazie per aver giocato!', 'The match has been closed. Thanks for playing!')}</p>}

        {session ? (
            <section className={styles.panel}>
              <h1 className={styles.title}>{L('Hai una partita in corso', 'You have a match in progress')}</h1>
              <button type="button" className={`btn btn-primary ${styles.wide}`} onClick={() => router.push(`/companion/${session.match_id}`)}>
                {L('Torna alla partita', 'Back to the match')} <ArrowRight size={20} />
              </button>
              <button type="button" className={`btn ${styles.wide}`} onClick={() => { clearSession(); setSession(null); }}>
                <LogOut size={18} /> {L('Entra in un’altra partita', 'Join another match')}
              </button>
            </section>
        ) : (
            <section className={styles.panel}>
              <h1 className={styles.title}><Smartphone size={22} aria-hidden="true" /> {L('Collegati alla partita', 'Join the match')}</h1>
              <p className={styles.help}>{L('Inquadra il QR sulla pagina della partita, oppure scrivi il codice di 6 caratteri.', 'Scan the QR on the match page, or type the 6-character code.')}</p>
              <form className={styles.codeForm} onSubmit={e => { e.preventDefault(); if (code.length === 6) void lookup(code); }}>
                <input className={styles.codeInput} value={code} onChange={e => { setCode(clean(e.target.value)); setFound(null); }}
                  inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                  aria-label={L('Codice della partita', 'Match code')} placeholder="ABC123" maxLength={6} />
                <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>{L('Cerca', 'Find')}</button>
              </form>
              {errorText && <p className={styles.error} role="alert">{errorText}</p>}

              {found && (
                  <>
                    <h2 className={styles.subtitle}>{L(`Giornata ${found.round}: quale squadra alleni?`, `Round ${found.round}: which team do you coach?`)}</h2>
                    <div className={styles.teamPick}>
                      {found.teams.map(t => (
                          <button key={t.id} type="button" className={styles.teamCard} disabled={busy || t.paired} onClick={() => join(t.id)}
                            style={{ '--team-color': t.color ?? undefined } as React.CSSProperties}>
                            <span className={`team-crest ${styles.teamCrest}`}>
                              {t.logo ? <img src={t.logo} alt="" /> : <Shield size={20} aria-hidden="true" />}
                            </span>
                            <span className={styles.teamCardName}>{t.name}</span>
                            <span className={styles.teamCardState}>{t.mine ? L('il tuo telefono: tocca per rientrare', 'your phone: tap to rejoin') : t.paired ? L('già collegata a un altro telefono', 'already paired with another phone') : L('tocca per scegliere', 'tap to choose')}</span>
                          </button>
                      ))}
                    </div>
                  </>
              )}
            </section>
        )}

        <InstallHint />
      </div>
  );
}
