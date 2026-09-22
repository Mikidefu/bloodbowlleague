'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { glossaryTip } from '@/lib/glossary';
import InfoTip from './InfoTip';
import styles from './Wizard.module.css';

export type WizardStep = { key: string; title: string };

/** Le parole chiave tra **doppi asterischi** diventano evidenziate: si vedono al primo colpo d'occhio.
 *  Se sono nel glossario, al passaggio del mouse spiegano cosa vogliono dire. */
export function rich(text: string, language: 'it' | 'en' = 'it'): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const tip = glossaryTip(part);
    return (
        <strong key={i} className={styles.key}>
          {tip ? <InfoTip text={tip[language]} label={part.replace(/"/g, '')}>{part}</InfoTip> : part}
        </strong>
    );
  });
}

/** Un'etichetta con il "?" se il termine è nel glossario (Treasury, CTV, Fan Factor...). */
export function Term({ children, tip }: { children: string; tip?: string }) {
  const { language } = useLanguage();
  const text = tip ?? glossaryTip(children)?.[language];
  return <>{children}{text && <InfoTip text={text} label={children} />}</>;
}

export type FactTone = 'good' | 'bad' | 'strong' | undefined;
export type FactRow = [string, ReactNode, FactTone?];

/** Righe etichetta / valore; il tono colora il valore (rosso se si sfora, verde se si guadagna). */
export function Facts({ rows }: { rows: FactRow[] }) {
  return (
      <dl className={styles.facts}>
        {rows.map(([k, v, tone]) => (
            <div key={k}>
              <dt><Term>{k}</Term></dt>
              <dd className={tone === 'bad' ? styles.bad : tone === 'good' ? styles.good : tone === 'strong' ? styles.strong : undefined}>{v}</dd>
            </div>
        ))}
      </dl>
  );
}

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
          {explain.map((p, i) => <p key={i}>{rich(p, language)}</p>)}
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
