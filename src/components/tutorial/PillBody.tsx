'use client';
import React from 'react';
import { GLOSSARY, KEY_TERMS, type Lang } from '@/lib/tutorial';
import styles from './PillBody.module.css';

// Il testo della pillola con i termini del gioco messi in evidenza.
// Ogni termine si accende una volta sola per pillola: se lo si evidenziasse ogni volta
// la pagina diventerebbe un albero di Natale e l'occhio smetterebbe di fidarsi.
// Per i termini più ostici l'evidenziazione porta anche la spiegazione breve (GLOSSARY).

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TERMS = Array.from(new Set(KEY_TERMS.map(term => term.toLowerCase())))
    .sort((a, b) => b.length - a.length);

const PATTERN = new RegExp(`\\b(${TERMS.map(escapeRe).join('|')})\\b`, 'gi');

function render(text: string, lang: Lang, used: Set<string>): React.ReactNode[] {
  return text.split(PATTERN).map((part, i) => {
    const key = part.toLowerCase();
    if (i % 2 === 0 || used.has(key)) return part;
    used.add(key);
    const gloss = GLOSSARY[key];
    return (
        <mark key={`${key}-${i}`} className={`${styles.key} ${gloss ? styles.hasGloss : ''}`} title={gloss ? gloss[lang] : undefined}>
          {part}
        </mark>
    );
  });
}

export default function PillBody({ paragraphs, lang }: { paragraphs: string[]; lang: Lang }) {
  const used = new Set<string>();
  return (
      <div className={styles.text}>
        {paragraphs.map((paragraph, i) => <p key={i}>{render(paragraph, lang, used)}</p>)}
      </div>
  );
}
