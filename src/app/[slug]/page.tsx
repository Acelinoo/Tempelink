import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPlatformSlugs,
  getPlatformSeoBySlug,
  getBaseUrl,
  PLATFORM_SEO_REGISTRY,
} from '@/lib/seo/platform-seo-data';
import { FaqJsonLd, WebAppJsonLd, BreadcrumbJsonLd } from '@/components/seo-structured-data';
import {
  Video,
  Film,
  PlaySquare,
  Share2,
  Pin,
  ArrowRight,
  ChevronRight,
  Info,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const XLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className || 'w-4 h-4'} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  tiktok: Video,
  instagram: Film,
  youtube: PlaySquare,
  x: XLogo,
  facebook: Share2,
  pinterest: Pin,
};

const PLATFORM_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  tiktok:    { badge: 'text-pink-400 bg-pink-950/40 border-pink-800/40',   text: 'text-pink-400',   bg: 'from-pink-500/10 to-transparent' },
  instagram: { badge: 'text-amber-500 bg-amber-950/40 border-amber-800/40', text: 'text-amber-500',  bg: 'from-amber-500/10 to-transparent' },
  youtube:   { badge: 'text-red-400 bg-red-950/40 border-red-800/40',       text: 'text-red-400',    bg: 'from-red-500/10 to-transparent' },
  x:         { badge: 'text-slate-200 bg-slate-800/60 border-slate-700/50', text: 'text-slate-200',  bg: 'from-slate-500/10 to-transparent' },
  facebook:  { badge: 'text-blue-400 bg-blue-950/40 border-blue-800/40',    text: 'text-blue-400',   bg: 'from-blue-500/10 to-transparent' },
  pinterest: { badge: 'text-rose-400 bg-rose-950/40 border-rose-800/40',    text: 'text-rose-400',   bg: 'from-rose-500/10 to-transparent' },
};

export function generateStaticParams() {
  return getAllPlatformSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getPlatformSeoBySlug(slug);
  if (!config) return {};

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/${config.slug}`;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonicalUrl,
      siteName: 'Tempelink',
      locale: 'id_ID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function PlatformLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const config = getPlatformSeoBySlug(slug);

  if (!config) notFound();

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/${config.slug}`;
  const Icon = PLATFORM_ICONS[config.platformId] || Video;
  const colorTheme = PLATFORM_COLORS[config.platformId] || {
    badge: 'text-app-cta bg-app-elevated border-app',
    text: 'text-app-cta',
    bg: 'from-app-cta/10 to-transparent',
  };

  const otherPlatforms = Object.values(PLATFORM_SEO_REGISTRY).filter((p) => p.slug !== config.slug);

  return (
    <div className="flex flex-col min-h-screen bg-app-main text-app-main transition-colors duration-200">
      <WebAppJsonLd url={canonicalUrl} name={config.title} description={config.description} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Beranda', url: baseUrl },
          { name: `${config.name} Downloader`, url: canonicalUrl },
        ]}
      />
      <FaqJsonLd faqs={config.faqs} />

      {/* Header */}
      <header className="w-full border-b border-app bg-app-surface/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 text-app-main hover:opacity-90 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-app-cta flex items-center justify-center font-black text-sm text-[var(--accent-cta-text)] shadow-sm">T</div>
            <span className="font-extrabold tracking-tight text-base sm:text-lg">Tempelink</span>
          </Link>
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-app-cta text-[var(--accent-cta-text)] hover:opacity-90 text-xs font-bold transition-all shadow-sm"
          >
            <span>Buka Pengunduh</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-app-subtle">
          <Link href="/" className="hover:text-app-main transition-colors">Beranda</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-app-muted font-medium">{config.name} Downloader</span>
        </nav>

        {/* Hero */}
        <section className={`relative rounded-2xl p-6 sm:p-10 border border-app bg-gradient-to-b ${colorTheme.bg} bg-app-surface overflow-hidden`}>
          <div className="max-w-2xl space-y-4">
            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-medium ${colorTheme.badge}`}>
              <Icon className={`w-3.5 h-3.5 ${colorTheme.text}`} />
              <span className={colorTheme.text}>{config.badge}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-app-main leading-tight">
              {config.h1}
            </h1>
            <p className="text-sm sm:text-base text-app-muted leading-relaxed">{config.h2Sub}</p>
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-app-cta text-[var(--accent-cta-text)] text-xs sm:text-sm font-bold shadow-md hover:opacity-90 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Mulai Unduh Sekarang</span>
              </Link>
              <a
                href="#cara-mengunduh"
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-app-surface hover:bg-app-elevated text-app-main text-xs sm:text-sm font-medium border border-app transition-colors"
              >
                <span>Lihat Panduan</span>
              </a>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-2xl font-bold text-app-main tracking-tight">
            Tentang Pengunduh {config.name} Tempelink
          </h2>
          <p className="text-xs sm:text-sm text-app-muted leading-relaxed">{config.aboutText}</p>
        </section>

        {/* Supported Formats */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-app-main tracking-tight">
              Format &amp; Resolusi yang Didukung
            </h2>
            <span className="text-[11px] font-mono text-app-cta bg-app-elevated px-2 py-0.5 rounded border border-app font-bold">
              Verifikasi Otomatis
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.supportedFormats.map((fmt, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-app-surface border border-app space-y-2 hover:border-[var(--border-focus)] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-app-main">{fmt.label}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-app-elevated text-app-cta border border-app font-bold">{fmt.quality}</span>
                </div>
                <p className="text-xs text-app-muted leading-relaxed">{fmt.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How To Steps */}
        <section id="cara-mengunduh" className="space-y-5">
          <h2 className="text-lg sm:text-2xl font-bold text-app-main tracking-tight">
            Cara Mengunduh Media {config.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {config.howToSteps.map((step) => (
              <div key={step.step} className="p-5 rounded-xl bg-app-surface border border-app flex flex-col space-y-2.5">
                <div className="w-7 h-7 rounded-lg bg-app-elevated border border-app text-app-cta flex items-center justify-center text-xs font-black">
                  {step.step}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-app-main">{step.title}</h3>
                <p className="text-xs text-app-muted leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported URLs */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-2xl font-bold text-app-main tracking-tight">Format Tautan yang Didukung</h2>
          <p className="text-xs sm:text-sm text-app-muted">
            Tempelink secara cerdas mengenali format tautan web, aplikasi seluler, dan tautan pendek resmi:
          </p>
          <div className="p-4 rounded-xl bg-app-surface border border-app font-mono text-[11px] sm:text-xs text-app-main space-y-2 overflow-x-auto">
            {config.supportedUrlExamples.map((ex, i) => (
              <div key={i} className="flex items-center space-x-2 text-app-cta">
                <span className="text-app-subtle select-none">#</span>
                <span className="break-all">{ex}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Limitations */}
        <section className="p-5 rounded-xl bg-app-surface border border-app space-y-3">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-app-cta shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-app-main">Batasan Teknis &amp; Transparansi Layanan</h2>
          </div>
          <ul className="space-y-2 text-xs text-app-muted list-disc list-inside">
            {config.limitations.map((lim, idx) => (
              <li key={idx} className="leading-relaxed">{lim}</li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="space-y-5">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-app-cta" />
            <h2 className="text-lg sm:text-2xl font-bold text-app-main tracking-tight">
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
          </div>
          <div className="space-y-3">
            {config.faqs.map((faq, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-app-surface border border-app space-y-2">
                <h3 className="text-xs sm:text-sm font-bold text-app-main">{faq.question}</h3>
                <p className="text-xs text-app-muted leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-linking */}
        <section className="border-t border-app pt-10 space-y-5">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-app-cta" />
            <h2 className="text-base sm:text-xl font-bold text-app-main tracking-tight">Pengunduh Platform Lainnya</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {otherPlatforms.map((op) => {
              const OpIcon = PLATFORM_ICONS[op.platformId] || Video;
              return (
                <Link
                  key={op.slug}
                  href={`/${op.slug}`}
                  className="p-3 rounded-xl bg-app-surface border border-app hover:border-[var(--border-focus)] hover:bg-app-elevated transition-all flex flex-col items-center justify-center text-center space-y-2 group"
                >
                  <OpIcon className="w-4 h-4 text-app-subtle group-hover:text-app-cta transition-colors" />
                  <span className="text-xs font-semibold text-app-muted group-hover:text-app-main transition-colors">
                    {op.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-app py-6 text-xs text-app-subtle mt-12 bg-app-surface/50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
            <a href="https://acelino.my.id" target="_blank" rel="noopener noreferrer"
               className="text-[11px] text-app-cta hover:underline">
              acelino.my.id
            </a>
          </div>
          <div className="flex items-center justify-center gap-4 pt-1 border-t border-app">
            <Link href="/" className="hover:text-app-cta transition-colors">Beranda</Link>
            <Link href="/about" className="hover:text-app-cta transition-colors">Tentang</Link>
            <Link href="/privacy" className="hover:text-app-cta transition-colors">Privasi</Link>
            <Link href="/terms" className="hover:text-app-cta transition-colors">Ketentuan</Link>
            <Link href="/contact" className="hover:text-app-cta transition-colors">Kontak</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
