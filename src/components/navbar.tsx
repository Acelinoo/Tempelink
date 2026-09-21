'use client';

import React from 'react';
import { History, Moon, Sun, Languages } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

interface NavbarProps {
  onOpenHistory: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenHistory, historyCount }) => {
  const { theme, toggleTheme, language, toggleLanguage, t } = useApp();

  return (
    <header className="w-full border-b border-app bg-app-surface/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-app-cta flex items-center justify-center font-black text-lg shadow-sm text-[var(--accent-cta-text)]">
            T
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-app-main flex items-center gap-1.5">
              TEMPELINK
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-app bg-app-elevated text-app-muted">
                v1.0
              </span>
            </span>
            <span className="text-xs text-app-subtle font-medium">
              {t('brandSubtitle')}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={t('languageSelect')}
            aria-label={t('languageSelect')}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-app bg-app-elevated hover:opacity-90 text-app-main transition-colors text-xs font-semibold cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-app-cta" />
            <span className="uppercase">{language}</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('themeToggleLight') : t('themeToggleDark')}
            aria-label={theme === 'dark' ? t('themeToggleLight') : t('themeToggleDark')}
            className="p-1.5 rounded-lg border border-app bg-app-elevated hover:opacity-90 text-app-main transition-colors text-xs cursor-pointer flex items-center justify-center"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-app-cta" />
            ) : (
              <Moon className="w-4 h-4 text-app-cta" />
            )}
          </button>

          {/* History Button */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-app bg-app-elevated hover:opacity-90 text-app-main transition-colors text-xs sm:text-sm font-semibold cursor-pointer"
          >
            <History className="w-4 h-4 text-app-cta" />
            <span className="hidden sm:inline">{t('historyButton')}</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-app-cta text-[var(--accent-cta-text)]">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
