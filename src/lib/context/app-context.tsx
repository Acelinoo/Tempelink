'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, Translations, translations } from '../i18n/translations';

export type ThemeMode = 'dark' | 'light';

interface AppContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Translations) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'tempelink_theme_mode';
const LANG_STORAGE_KEY = 'tempelink_lang_pref';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [language, setLanguageState] = useState<Language>('id');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setThemeState(storedTheme);
        applyThemeClass(storedTheme);
      } else {
        applyThemeClass('dark');
      }

      const storedLang = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
      if (storedLang === 'id' || storedLang === 'en') {
        setLanguageState(storedLang);
      }
    } catch {
      // Fallback to default
      applyThemeClass('dark');
    }
    setIsHydrated(true);
  }, []);

  const applyThemeClass = (newTheme: ThemeMode) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'id' ? 'en' : 'id');
  };

  const t = (key: keyof Translations): string => {
    const langDict = translations[language] || translations.id;
    return langDict[key] || translations.id[key] || String(key);
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        language,
        setLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    // Safe fallback for SSR / error boundaries rendered outside AppProvider
    return {
      theme: 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
      language: 'id',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: keyof Translations): string =>
        translations.id[key] ?? String(key),
    };
  }
  return context;
}
