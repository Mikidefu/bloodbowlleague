'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Skull, Trophy, Users, Calendar, Menu, X, Book } from 'lucide-react'; // Aggiunta icona Book
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext';

function NavBar() {
  const { language, setLanguage, t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
      <>
        <nav className="nav-bar">
          <Link href="/" className="logo">
            <Skull size={32} color="var(--color-blood-bright)" />
            <span>BLOODBOWL MANAGER</span>
          </Link>

          {/* Desktop Links */}
          <div className="nav-links desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link href="/teams"><Users size={20} className="inline mr-1 mb-1" />{t.nav.teams}</Link>
            <Link href="/schedule"><Calendar size={20} className="inline mr-1 mb-1" />{t.nav.schedule}</Link>
            <Link href="/standings"><Trophy size={20} className="inline mr-1 mb-1" />{t.nav.standings}</Link>
            <Link href="/stats"><Trophy size={20} className="inline mr-1 mb-1" />{t.nav.stats}</Link>

            {/* NUOVO LINK SKILLS DESKTOP */}
            <Link href="/skills"><Book size={20} className="inline mr-1 mb-1" />{t.nav.skills}</Link>

            {/* Language Switcher */}
            <div style={{ display: 'flex', gap: '1rem', borderLeft: '1px solid var(--color-glass-border)', paddingLeft: '2rem', height: '30px', alignItems: 'center' }}>
              <button
                  onClick={() => setLanguage('en')}
                  className="lang-btn"
                  style={{ opacity: language === 'en' ? 1 : 0.4, transform: language === 'en' ? 'scale(1.1)' : 'scale(1)' }}
              >🇬🇧</button>
              <button
                  onClick={() => setLanguage('it')}
                  className="lang-btn"
                  style={{ opacity: language === 'it' ? 1 : 0.4, transform: language === 'it' ? 'scale(1.1)' : 'scale(1)' }}
              >🇮🇹</button>
            </div>
          </div>

          {/* Hamburger Button */}
          <button
              className="mobile-only hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-bone)' }}
          >
            <Menu size={32} />
          </button>
        </nav>

        {/* Mobile Sidebar */}
        <div className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div style={{ padding: '1rem 2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-bone)' }}
            >
              <X size={32} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '2rem', gap: '2rem' }}>
            <Link href="/teams" onClick={() => setIsMobileMenuOpen(false)}><Users size={24} className="inline mr-2 mb-1" />{t.nav.teams}</Link>
            <Link href="/schedule" onClick={() => setIsMobileMenuOpen(false)}><Calendar size={24} className="inline mr-2 mb-1" />{t.nav.schedule}</Link>
            <Link href="/standings" onClick={() => setIsMobileMenuOpen(false)}><Trophy size={24} className="inline mr-2 mb-1" />{t.nav.standings}</Link>
            <Link href="/stats" onClick={() => setIsMobileMenuOpen(false)}><Trophy size={24} className="inline mr-2 mb-1" />{t.nav.stats}</Link>

            {/* NUOVO LINK SKILLS MOBILE */}
            <Link href="/skills" onClick={() => setIsMobileMenuOpen(false)}><Book size={24} className="inline mr-2 mb-1" />{t.nav.skills}</Link>

            <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', borderTop: '1px solid var(--color-glass-border)', paddingTop: '2rem' }}>
              <button
                  onClick={() => { setLanguage('en'); setIsMobileMenuOpen(false); }}
                  className="lang-btn"
                  style={{ opacity: language === 'en' ? 1 : 0.4, transform: language === 'en' ? 'scale(1.1)' : 'scale(1)' }}
              >🇬🇧 English</button>
              <button
                  onClick={() => { setLanguage('it'); setIsMobileMenuOpen(false); }}
                  className="lang-btn"
                  style={{ opacity: language === 'it' ? 1 : 0.4, transform: language === 'it' ? 'scale(1.1)' : 'scale(1)' }}
              >🇮🇹 Italiano</button>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
            <div
                className="mobile-overlay"
                onClick={() => setIsMobileMenuOpen(false)}
            />
        )}
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