'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './Wizard.module.css';

export type WizardStep = { key: string; title: string };

/** Le tappe del percorso: fatte, in corso, da fare. Si può tornare solo indietro. */
export function WizardSteps({ steps, current, onJump }: { steps: WizardStep[]; current: number; onJump?: (index: number) => void }) {
  return (
      <ol className={styles.steps}>
        {steps.map((s, i) => {
          const state = i < current ? styles.stepDone : i === current ? styles.stepNow : '';
          return (
              <li key={s.key} className={`${styles.stepItem} ${state}`} aria-current={i === current ? 'step' : undefined}>
                {onJump && i < current ? (
                    <button type="button" className={styles.stepBtn} onClick={() => onJump(i)}>
                      <span className={styles.stepNum}>{i < current ? <CheckCircle2 size={16} /> : i + 1}</span> {s.title}
                    </button>
                ) : (
                    <span className={styles.stepBtn}>
                      <span className={styles.stepNum}>{i < current ? <CheckCircle2 size={16} /> : i + 1}</span> {s.title}
                    </span>
                )}
              </li>
          );
        })}
      </ol>
  );
}

type StepProps = {
  title: string;
  page?: string;               // pagina del Rulebook
  explain: string[];           // spiegazione: un paragrafo per riga
  children?: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  blocker?: string | null;     // perché non si può ancora continuare
  busy?: boolean;
};

/** Un passo: cosa succede e perché, i campi, e il pulsante per confermare e andare avanti. */
export function WizardStepCard({ title, page, explain, children, onBack, onNext, nextLabel, nextDisabled, blocker, busy }: StepProps) {
  const { language } = useLanguage();
  const L = (it: string, en: string) => (language === 'it' ? it : en);
  return (
      <section className={`card ${styles.card}`}>
        <header className={styles.cardHead}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {page && <span className={styles.page}><BookOpen size={14} aria-hidden="true" /> {page}</span>}
        </header>
        <div className={styles.explain}>
          {explain.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {children && <div className={styles.body}>{children}</div>}
        {(onBack || onNext) && (
            <footer className={styles.foot}>
              {onBack ? (
                  <button type="button" className="btn" onClick={onBack} disabled={busy}><ArrowLeft size={18} /> {L('Indietro', 'Back')}</button>
              ) : <span />}
              <span className={styles.footRight}>
                {blocker && <span className={styles.blocker}>{blocker}</span>}
                {onNext && (
                    <button type="button" className="btn btn-primary" onClick={onNext} disabled={nextDisabled || !!blocker || busy}>
                      {nextLabel ?? L('Conferma e continua', 'Confirm and continue')} <ArrowRight size={18} />
                    </button>
                )}
              </span>
            </footer>
        )}
      </section>
  );
}
