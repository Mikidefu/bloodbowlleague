import type { Metadata, Viewport } from 'next';

// Companion app: la pagina che l'allenatore installa sul telefono ("Aggiungi a schermata Home").
// Manifest solo per /companion, così installare il sito normale non apre la companion.
export const metadata: Metadata = {
  title: 'BBL Companion',
  description: 'Turni, reroll e statistiche della tua squadra durante una partita di lega.',
  manifest: '/companion.webmanifest',
  appleWebApp: { capable: true, title: 'BBL Companion', statusBarStyle: 'black-translucent' },
  icons: { apple: '/companion-icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#22262d',
  viewportFit: 'cover',   // su iPhone il colore arriva sotto la tacca; i margini li danno le safe-area
};

export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
