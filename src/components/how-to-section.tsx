'use client';

import React from 'react';
import { Copy, ClipboardPaste, Download } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

const STEPS = [
  { icon: Copy,          titleKey: 'howToStep1Title' as const, descKey: 'howToStep1Desc' as const },
  { icon: ClipboardPaste, titleKey: 'howToStep2Title' as const, descKey: 'howToStep2Desc' as const },
  { icon: Download,      titleKey: 'howToStep3Title' as const, descKey: 'howToStep3Desc' as const },
];

export const HowToSection: React.FC = () => {
  const { t } = useApp();

  return (
    <section className="w-full border-t border-app pt-10 pb-4">
      <h2 className="text-xl sm:text-2xl font-black text-app-main text-center mb-10 tracking-tight">
        {t('howToTitle')}
      </h2>

      <div className="relative grid grid-cols-3 gap-2 sm:gap-6 items-start justify-center">
        {/* Connecting line (desktop) */}
        <div
          className="hidden sm:block absolute top-8 left-1/2 -translate-x-1/2 h-px bg-app-surface border-t border-app"
          style={{ width: 'calc(66.6% - 40px)' }}
          aria-hidden="true"
        />

        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={idx}
              className="relative flex flex-col items-center text-center px-1 sm:px-4"
            >
              {/* Step number badge */}
              <div className="relative mb-2.5 sm:mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-app-surface border-2 border-app flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-app-cta" />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-app-cta text-[var(--accent-cta-text)] text-[10px] sm:text-xs font-black flex items-center justify-center shadow-sm">
                  {idx + 1}
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-app-main mb-1 leading-snug">
                {t(step.titleKey)}
              </h3>
              <p className="text-[10px] sm:text-xs text-app-muted leading-tight sm:leading-relaxed">
                {t(step.descKey)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
