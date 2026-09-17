'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { translations, Language } from './translations';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'bbowl-lang';
const CHANGE_EVENT = 'bbowl-lang-change';

// La lingua vive in localStorage: useSyncExternalStore la legge senza setState dentro un effect.
// Sul server (e durante l'idratazione) vale 'en', poi React passa al valore salvato.
// Copia in memoria: usata se localStorage non è disponibile (es. navigazione privata restrittiva)
let memoryLanguage: Language = 'en';

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'it' || saved === 'en' ? saved : memoryLanguage;
  } catch {
    return memoryLanguage;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange); // altre schede
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, readLanguage, () => 'en' as Language);

  const setLanguage = (lang: Language) => {
    memoryLanguage = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage non disponibile: resta la copia in memoria fino al reload
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
