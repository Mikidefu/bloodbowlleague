'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './ConfirmDialog.module.css';

export type ConfirmOptions = {
  message: React.ReactNode;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Azione distruttiva: pulsante rosso e fuoco su "Annulla"
  danger?: boolean;
};

type Ask = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<Ask | undefined>(undefined);

// Finestra di conferma dell'app al posto del confirm() del browser:
//   const confirm = useConfirm();
//   if (!await confirm({ message: '...', danger: true })) return;
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFocus = useRef<HTMLButtonElement>(null);

  const ask = useCallback<Ask>(input => new Promise<boolean>(resolve => {
    resolver.current?.(false);   // una richiesta ancora aperta vale come "annulla"
    resolver.current = resolve;
    setOptions(typeof input === 'string' ? { message: input } : input);
  }), []);

  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    dialogRef.current?.close();   // riporta il fuoco al pulsante che aveva aperto la finestra
    setOptions(null);
  };

  // showModal() mette la finestra nel top layer (sopra gli altri popup), blocca il resto della pagina
  // e gestisce Esc; il fuoco parte da "Conferma" (da "Annulla" se l'azione è distruttiva)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!options || !dialog || dialog.open) return;
    dialog.showModal();
    firstFocus.current?.focus();
  }, [options]);

  return (
      <ConfirmContext.Provider value={ask}>
        {children}
        {options && (
            <dialog
                ref={dialogRef}
                className={styles.dialog}
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
                onCancel={e => { e.preventDefault(); settle(false); }}
                onClick={e => { if (e.target === e.currentTarget) settle(false); }}
            >
              <div className={`card chamfer ${styles.box} ${options.danger ? styles.danger : ''}`}>
                <span className={styles.micro}><i aria-hidden="true" />BBL // {t.confirm.micro}</span>
                <h3 id="confirm-title" className={`subhead ${styles.title}`}>{options.title ?? t.confirm.title}</h3>
                <div id="confirm-message" className={styles.message}>{options.message}</div>
                <div className={styles.actions}>
                  <button type="button" className="btn" ref={options.danger ? firstFocus : undefined} onClick={() => settle(false)}>
                    <span>{options.cancelLabel ?? t.confirm.cancel}</span>
                  </button>
                  <button type="button" className={`btn ${options.danger ? 'btn-primary' : 'btn-navy'}`} ref={options.danger ? undefined : firstFocus} onClick={() => settle(true)}>
                    <span>{options.confirmLabel ?? t.confirm.ok}</span>
                  </button>
                </div>
              </div>
            </dialog>
        )}
      </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
