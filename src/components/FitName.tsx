import type { CSSProperties } from 'react';

/**
 * Quanto rimpicciolire un nome perché stia nel suo spazio: 1 se è corto, giù fino a `min`.
 * `comfy` = lettere della parola più lunga che stanno comode a font pieno (dipende dal punto della pagina).
 * Conta la parola più lunga (non può andare a capo) e, per i nomi di molte parole, la lunghezza totale.
 */
export function nameFitScale(name: string, comfy = 12, min = 0.6): number {
  const text = name.trim();
  if (!text) return 1;
  const longest = Math.max(...text.split(/[\s\-/]+/).map(word => word.length));
  const byWord = comfy / longest;
  const byLength = Math.sqrt((comfy * 3) / text.length);
  return Math.round(Math.max(min, Math.min(1, byWord, byLength)) * 100) / 100;
}

/** Classe e stile da mettere su un elemento che contiene solo il nome (vedi .fit-name in globals.css). */
export function nameFit(name: string, comfy?: number, min?: number): { className: string; style: CSSProperties } {
  return { className: 'fit-name', style: { '--name-fit': nameFitScale(name, comfy, min) } as CSSProperties };
}

/**
 * Nome di squadra, giocatore o allenatore che non rompe mai l'impaginazione: se è lungo il font si
 * rimpicciolisce, se non basta va a capo anche a metà parola. Con `lines` si ferma a quel numero di
 * righe e mette i puntini (il nome intero resta nel title).
 */
export default function FitName({ children, comfy, min, lines }: { children: string; comfy?: number; min?: number; lines?: number }) {
  const fit = nameFit(children, comfy, min);
  if (!lines) return <span {...fit}>{children}</span>;
  return (
      <span className={`${fit.className} fit-name-clamp`} style={{ ...fit.style, '--name-lines': lines } as CSSProperties} title={children}>
        {children}
      </span>
  );
}
