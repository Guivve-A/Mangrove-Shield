import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { translations, Language, Translations } from './translations';

// ─── Context shape ────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to Spanish; localStorage preference applied client-side in useEffect
  // to avoid SSR/hydration mismatch on static export.
  const [lang, setLangState] = useState<Language>('es');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mangrove_lang') as Language | null;
      if (stored === 'en' || stored === 'es') {
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable (e.g., SSR, private browsing)
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('mangrove_lang', newLang);
    } catch {
      // ignore
    }
  };

  const toggleLang = () => setLang(lang === 'en' ? 'es' : 'en');

  const t = useMemo(() => translations[lang], [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within a LanguageProvider');
  return ctx;
}
