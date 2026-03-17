'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, Users, Calendar, Menu, X, Book } from 'lucide-react'; // Rimossa l'icona Skull
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext';
import styles from './NavBar.module.css';

function NavBar() {
  const { language, setLanguage, t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Blocca lo scroll del body quando il menu mobile è aperto
  if (typeof window !== 'undefined') {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
  }

  return (
      <>
        <nav className={styles.navBar}>
          {/* NUOVA STRUTTURA LOGO CON IMMAGINE GRAFICA UFFICIALE */}
          <Link href="/" className={styles.logoLink}>
            <img
                src="/logo-blood-bowl.png" // Percorso del file che hai salvato in public/
                alt="Blood Bowl Official Logo"
                className={styles.logoImage}
            />
          </Link>

          {/* Desktop Links */}
          <div className={styles.navLinks}>
            <Link href="/teams" className={styles.navItem}><Users size={20} />{t.nav.teams}</Link>
            <Link href="/schedule" className={styles.navItem}><Calendar size={20} />{t.nav.schedule}</Link>
            <Link href="/standings" className={styles.navItem}><Trophy size={20} />{t.nav.standings}</Link>
            <Link href="/stats" className={styles.navItem}><Trophy size={20} />{t.nav.stats}</Link>
            <Link href="/skills" className={styles.navItem}><Book size={20} />{t.nav.skills}</Link>

            {/* Language Switcher */}
            <div className={styles.langContainer}>
              <button
                  onClick={() => setLanguage('en')}
                  className={`${styles.langBtn} ${language === 'en' ? styles.active : ''}`}
              >EN</button>
              <button
                  onClick={() => setLanguage('it')}
                  className={`${styles.langBtn} ${language === 'it' ? styles.active : ''}`}
              >IT</button>
            </div>
          </div>

          {/* Hamburger Button (Mobile) */}
          <button
              className={styles.hamburgerBtn}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
          >
            <Menu size={36} />
          </button>
        </nav>

        {/* Mobile Sidebar */}
        <div className={`${styles.mobileSidebar} ${isMobileMenuOpen ? styles.open : ''}`}>
          <div className={styles.closeHeader}>
            <button
                className={styles.closeBtn}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
            >
              <X size={36} />
            </button>
          </div>

          <div className={styles.mobileMenuContent}>
            <Link href="/teams" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
              <Users size={28} />{t.nav.teams}
            </Link>
            <Link href="/schedule" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
              <Calendar size={28} />{t.nav.schedule}
            </Link>
            <Link href="/standings" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
              <Trophy size={28} />{t.nav.standings}
            </Link>
            <Link href="/stats" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
              <Trophy size={28} />{t.nav.stats}
            </Link>
            <Link href="/skills" className={styles.mobileNavItem} onClick={() => setIsMobileMenuOpen(false)}>
              <Book size={28} />{t.nav.skills}
            </Link>

            {/* Mobile Language Switcher */}
            <div className={styles.mobileLangContainer}>
              <button
                  onClick={() => { setLanguage('en'); setIsMobileMenuOpen(false); }}
                  className={`${styles.mobileLangBtn} ${language === 'en' ? styles.active : ''}`}
              >EN (English)</button>
              <button
                  onClick={() => { setLanguage('it'); setIsMobileMenuOpen(false); }}
                  className={`${styles.mobileLangBtn} ${language === 'it' ? styles.active : ''}`}
              >IT (Italiano)</button>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        <div
            className={`${styles.mobileOverlay} ${isMobileMenuOpen ? styles.open : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
        />
      </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
      <LanguageProvider>
        <NavBar />
        <main className="container">
          {children}
        </main>
      </LanguageProvider>
  );
}