'use client';

import React from 'react';
import { ShieldOff, Monitor, UserX, Star, Globe, Music } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

const FEATURES = [
  { icon: ShieldOff, titleKey: 'featNoWatermark' as const, descKey: 'featNoWatermarkDesc' as const },
  { icon: Monitor,   titleKey: 'featAllDevices'  as const, descKey: 'featAllDevicesDesc'  as const },
  { icon: UserX,     titleKey: 'featNoLogin'     as const, descKey: 'featNoLoginDesc'     as const },
  { icon: Star,      titleKey: 'featOrigQuality' as const, descKey: 'featOrigQualityDesc' as const },
  { icon: Globe,     titleKey: 'featMultiPlatform' as const, descKey: 'featMultiPlatformDesc' as const },
  { icon: Music,     titleKey: 'featAudioMp3'   as const, descKey: 'featAudioMp3Desc'   as const },
];

export const FeaturesSection: React.FC = () => {
  const { t } = useApp();

  return (
    <section className="w-full border-t border-app pt-10 pb-4">
      <h2 className="text-xl sm:text-2xl font-black text-app-main text-center mb-8 tracking-tight">
        {t('featuresTitle')}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {FEATURES.map((feat, idx) => {
          const Icon = feat.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-xl bg-app-surface border border-app hover:border-[var(--border-focus)] transition-colors duration-200 flex flex-col space-y-2"
            >
              <div className="w-9 h-9 rounded-lg bg-app-elevated border border-app flex items-center justify-center">
                <Icon className="w-4 h-4 text-app-cta" />
              </div>
              <h3 className="text-sm font-bold text-app-main">{t(feat.titleKey)}</h3>
              <p className="text-xs text-app-muted leading-relaxed">{t(feat.descKey)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
