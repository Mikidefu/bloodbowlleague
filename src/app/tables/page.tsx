'use client';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { ART } from '@/lib/art';
import PageHeader from '@/components/brand/PageHeader';
import MatchTables from '@/components/match/MatchTables';
import styles from './Tables.module.css';

// Tabelle da consultare durante la partita: meteo, kick-off, infortuni, Prayers to Nuffle...
export default function TablesPage() {
  const { t } = useLanguage();

  return (
      <div className={styles.page}>
        <PageHeader
            kicker="BLOODBOWL LEAGUE"
            title={t.tables.title}
            subtitle={t.tables.subtitle}
            icon={<Dices size={44} />}
            art={ART.headers.match}
        />
        <p className={`card ${styles.intro}`}>{t.tables.intro}</p>
        <MatchTables />
      </div>
  );
}
