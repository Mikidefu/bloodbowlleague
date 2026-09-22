'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Users, Calendar, Menu, X, Book, Lock, LogOut, BarChart3, UserRound, GraduationCap } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { SeasonProvider } from '@/lib/SeasonContext';
import Emblem from '@/components/brand/Emblem';
import Wordmark from '@/components/brand/Wordmark';
import Shards from '@/components/brand/Shards';
import SeasonBar from './SeasonBar';
import styles from './NavBar.module.css';

const NAV_LINKS = [
  { href: '/teams', key: 'teams', Icon: Users },
  { href: '/schedule', key: 'schedule', Icon: Calendar },
  { href: '/standings', key: 'standings', Icon: Trophy },
  { href: '/stats', key: 'stats', Icon: BarChart3 },
  { href: '/coaches', key: 'coaches', Icon: UserRound },
  { href: '/skills', key: 'skills', Icon: Book },
  { href: '/tutorial', key: 'tutorial', Icon: GraduationCap },
] as const;

function NavBar() {
  const { language, setLanguage, t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAdmin } = useAuth();
  const pathname = usePathname();

  // Blocca lo scroll del body quando il menu mobile è aperto
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
  }, [isMobileMenuOpen]);

  const closeMenu = () => setIsMobileMenuOpen(false);
  const isActive = (href: string) => pathname.startsWith(href);
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Ricarica completa per azzerare lo stato admin in tutta l'app
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/';
  };

  return (
      <>
        <nav className={styles.navBar}>
          <Link href="/" className={styles.logoLink} aria-label="Blood Bowl League – Home">
            <Emblem size={64} className={styles.logoEmblem} />
            <Wordmark className={styles.wordmark} />
          </Link>

          {/* Desktop Links */}
          <div className={styles.navLinks}>
            {NAV_LINKS.map(({ href, key, Icon }, i) => (
                <Link
                    key={href}
                    href={href}
                    className={`${styles.navItem} ${isActive(href) ? styles.active : ''}`}
                    aria-current={isActive(href) ? 'page' : undefined}
                >
                  <span className={styles.navIndex} aria-hidden="true">{pad(i + 1)}</span>
                  <Icon size={16} className={styles.navIcon} />
                  <span>{t.nav[key]}</span>
                </Link>
            ))}
          </div>

          <div className={styles.navTools}>
            {isAdmin ? (
                <button onClick={handleLogout} className={styles.ctaBtn}>
                  <LogOut size={16} /><span>{t.nav.logout}</span>
                </button>
            ) : (
                <Link href="/login" className={`${styles.ctaBtn} ${isActive('/login') ? styles.ctaActive : ''}`}>
                  <Lock size={16} /><span>{t.nav.login}</span>
                </Link>
            )}

            {/* Language Switcher */}
            <div className={styles.langContainer} role="group" aria-label="Language">
              <button
                  onClick={() => setLanguage('en')}
                  className={`${styles.langBtn} ${language === 'en' ? styles.active : ''}`}
                  aria-pressed={language === 'en'}
              >EN</button>
              <button
                  onClick={() => setLanguage('it')}
                  className={`${styles.langBtn} ${language === 'it' ? styles.active : ''}`}
                  aria-pressed={language === 'it'}
              >IT</button>
            </div>
          </div>

          {/* Hamburger Button (Mobile) */}
          <button
              className={styles.hamburgerBtn}
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
          >
            <Menu size={26} />
          </button>
        </nav>

        {/* Mobile Sidebar */}
        <div className={`${styles.mobileSidebar} ${isMobileMenuOpen ? styles.open : ''}`} aria-hidden={!isMobileMenuOpen}>
          <Shards variant="band" className={styles.sidebarShards} />
          <div className={styles.closeHeader}>
            <Emblem size={52} />
            <span className={styles.sidebarMicro}>BBL // Menu</span>
            <button className={styles.closeBtn} onClick={closeMenu} aria-label="Close menu">
              <X size={26} />
            </button>
          </div>

          <div className={styles.mobileMenuContent}>
            {NAV_LINKS.map(({ href, key, Icon }, i) => (
                <Link
                    key={href}
                    href={href}
                    className={`${styles.mobileNavItem} ${isActive(href) ? styles.active : ''}`}
                    onClick={closeMenu}
                >
                  <span className={styles.mobileIndex} aria-hidden="true">{pad(i + 1)}</span>
                  <span className={styles.mobileLabel}>{t.nav[key]}</span>
                  <Icon size={22} className={styles.mobileIcon} />
                </Link>
            ))}

            {isAdmin ? (
                <button onClick={handleLogout} className={styles.mobileCta}>
                  <LogOut size={20} />{t.nav.logout}
                </button>
            ) : (
                <Link href="/login" className={styles.mobileCta} onClick={closeMenu}>
                  <Lock size={20} />{t.nav.login}
                </Link>
            )}

            {/* Mobile Language Switcher */}
            <div className={styles.mobileLangContainer}>
              <button
                  onClick={() => { setLanguage('en'); closeMenu(); }}
                  className={`${styles.mobileLangBtn} ${language === 'en' ? styles.active : ''}`}
              >EN (English)</button>
              <button
                  onClick={() => { setLanguage('it'); closeMenu(); }}
                  className={`${styles.mobileLangBtn} ${language === 'it' ? styles.active : ''}`}
              >IT (Italiano)</button>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        <div className={`${styles.mobileOverlay} ${isMobileMenuOpen ? styles.open : ''}`} onClick={closeMenu} />
      </>
  );
}

function SiteFooter() {
  return (
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerTitle}>Blood Bowl League</span>
          <span className={styles.footerDot} aria-hidden="true">•</span>
          <span className={styles.footerSub}>The Game of Fantasy Football</span>
        </div>
        <span className="page-tab">{new Date().getFullYear()}</span>
      </footer>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
      <LanguageProvider>
        <AuthProvider>
          <SeasonProvider>
            <NavBar />
            <SeasonBar />
            <main className="container">
              {children}
            </main>
            <SiteFooter />
            <div className="page-rail" aria-hidden="true"><i /><i /><i /><i /><span>BBL // New Season</span></div>
          </SeasonProvider>
        </AuthProvider>
      </LanguageProvider>
  );
}
