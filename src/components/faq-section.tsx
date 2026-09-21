'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';
import { FaqJsonLd } from '@/components/seo-structured-data';

interface FaqItem {
  qKey: string;
  aKey: string;
}

const FAQ_ITEMS: FaqItem[] = [
  { qKey: 'faqQ1', aKey: 'faqA1' },
  { qKey: 'faqQ2', aKey: 'faqA2' },
  { qKey: 'faqQ3', aKey: 'faqA3' },
  { qKey: 'faqQ4', aKey: 'faqA4' },
  { qKey: 'faqQ5', aKey: 'faqA5' },
  { qKey: 'faqQ6', aKey: 'faqA6' },
  { qKey: 'faqQ7', aKey: 'faqA7' },
  { qKey: 'faqQ8', aKey: 'faqA8' },
];

export const FaqSection: React.FC = () => {
  const { t } = useApp();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const structuredFaqs = useMemo(
    () =>
      FAQ_ITEMS.map((item) => ({
        question: t(item.qKey as Parameters<typeof t>[0]),
        answer: t(item.aKey as Parameters<typeof t>[0]),
      })),
    [t]
  );

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="w-full border-t border-app pt-10 pb-4">
      <FaqJsonLd faqs={structuredFaqs} />
      <h2 className="text-xl sm:text-2xl font-black text-app-main text-center mb-8 tracking-tight">
        {t('faqTitle')}
      </h2>

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between py-4 text-left gap-4 cursor-pointer group"
                aria-expanded={isOpen}
              >
                <span className={`text-sm font-semibold transition-colors ${isOpen ? 'text-app-cta' : 'text-app-main group-hover:text-app-cta'}`}>
                  {t(item.qKey as Parameters<typeof t>[0])}
                </span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 text-app-subtle transition-transform duration-200 ${isOpen ? 'rotate-180 text-app-cta' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="pb-4 pr-8">
                  <p className="text-xs sm:text-sm text-app-muted leading-relaxed">
                    {t(item.aKey as Parameters<typeof t>[0])}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
