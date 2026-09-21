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
import { FaqJsonLd, WebAppJsonLd } from '@/components/seo-structured-data';
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

// Crisp X Logo icon
const XLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className || 'w-4 h-4'}
    fill="currentColor"
  >
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
  tiktok: {
    badge: 'text-pink-400 bg-pink-950/40 border-pink-800/40',
    text: 'text-pink-400',
    bg: 'from-pink-500/10 to-transparent',
  },
  instagram: {
    badge: 'text-purple-400 bg-purple-950/40 border-purple-800/40',
    text: 'text-purple-400',
    bg: 'from-purple-500/10 to-transparent',
  },
  youtube: {
    badge: 'text-red-400 bg-red-950/40 border-red-800/40',
    text: 'text-red-400',
    bg: 'from-red-500/10 to-transparent',
  },
  x: {
    badge: 'text-slate-200 bg-slate-800/60 border-slate-700/50',
    text: 'text-slate-200',
    bg: 'from-slate-500/10 to-transparent',
  },
  facebook: {
    badge: 'text-blue-400 bg-blue-950/40 border-blue-800/40',
    text: 'text-blue-400',
    bg: 'from-blue-500/10 to-transparent',
  },
  pinterest: {
    badge: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    text: 'text-rose-400',
    bg: 'from-rose-500/10 to-transparent',
  },
};

export function generateStaticParams() {
  return getAllPlatformSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getPlatformSeoBySlug(slug);
  if (!config) {
    return {};
  }

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/${config.slug}`;

  return {
    title: config.title,
    description: config.description,
    keywords: config.keywords,
    alternates: {
      canonical: canonicalUrl,
    },
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
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function PlatformLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const config = getPlatformSeoBySlug(slug);

  if (!config) {
    notFound();
  }

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/${config.slug}`;
  const Icon = PLATFORM_ICONS[config.platformId] || Video;
  const colorTheme = PLATFORM_COLORS[config.platformId] || {
    badge: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40',
    text: 'text-cyan-400',
    bg: 'from-cyan-500/10 to-transparent',
  };

  // Other platforms for cross-linking
  const otherPlatforms = Object.values(PLATFORM_SEO_REGISTRY).filter(
    (p) => p.slug !== config.slug
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-slate-100">
      {/* Schema.org Structured Data */}
      <WebAppJsonLd
        url={canonicalUrl}
        name={config.title}
        description={config.description}
      />
      <FaqJsonLd faqs={config.faqs} />

      {/* Top Simple Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center space-x-2 text-white hover:opacity-90 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-cyan-500/20">
              T
            </div>
            <span className="font-black tracking-tight text-base sm:text-lg">
              Tempelink
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-all"
          >
            <span>Buka Pengunduh</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-slate-300 transition-colors">
            Beranda
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-300 font-medium">
            {config.name} Downloader
          </span>
        </nav>

        {/* Hero Section */}
        <section className={`relative rounded-2xl p-6 sm:p-10 border border-slate-800 bg-gradient-to-b ${colorTheme.bg} bg-slate-900/60 overflow-hidden`}>
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-medium backdrop-blur-sm shadow-sm">
              <Icon className={`w-3.5 h-3.5 ${colorTheme.text}`} />
              <span className={colorTheme.text}>{config.badge}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {config.h1}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {config.h2Sub}
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Mulai Unduh Sekarang</span>
              </Link>
              <a
                href="#cara-mengunduh"
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs sm:text-sm font-medium border border-slate-700/60 transition-colors"
              >
                <span>Lihat Panduan</span>
              </a>
            </div>
          </div>
        </section>

        {/* About & Overview Section */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Tentang Pengunduh {config.name} Tempelink
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {config.aboutText}
          </p>
        </section>

        {/* Supported Formats Grid */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              Format & Resolusi yang Didukung
            </h2>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
              Verifikasi Otomatis
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.supportedFormats.map((fmt, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    {fmt.label}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                    {fmt.quality}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {fmt.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How To Steps */}
        <section id="cara-mengunduh" className="space-y-5">
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Cara Mengunduh Media {config.name}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {config.howToSteps.map((step) => (
              <div
                key={step.step}
                className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col space-y-2.5 relative"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-950/70 border border-cyan-800/40 text-cyan-400 flex items-center justify-center text-xs font-black">
                  {step.step}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Link Syntax */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Format Tautan yang Didukung
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Tempelink secara cerdas mengenali format tautan web, aplikasi seluler, dan tautan pendek resmi:
          </p>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 font-mono text-[11px] sm:text-xs text-slate-300 space-y-2 overflow-x-auto">
            {config.supportedUrlExamples.map((ex, i) => (
              <div key={i} className="flex items-center space-x-2 text-cyan-300/90">
                <span className="text-slate-600 select-none">#</span>
                <span className="break-all">{ex}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Honest Limitations & Privacy */}
        <section className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-slate-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-white">
              Batasan Teknis & Transparansi Layanan
            </h2>
          </div>
          <ul className="space-y-2 text-xs text-slate-400 list-disc list-inside">
            {config.limitations.map((lim, idx) => (
              <li key={idx} className="leading-relaxed">
                {lim}
              </li>
            ))}
          </ul>
        </section>

        {/* Frequently Asked Questions (FAQ) */}
        <section className="space-y-5">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
          </div>

          <div className="space-y-3">
            {config.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2"
              >
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {faq.question}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Cross-linking to Other Platforms */}
        <section className="border-t border-slate-800/80 pt-10 space-y-5">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">
              Pengunduh Platform Lainnya
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {otherPlatforms.map((op) => {
              const OpIcon = PLATFORM_ICONS[op.platformId] || Video;
              return (
                <Link
                  key={op.slug}
                  href={`/${op.slug}`}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 transition-all flex flex-col items-center justify-center text-center space-y-2 group"
                >
                  <OpIcon className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    {op.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 Tempelink. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <Link href="/" className="hover:text-cyan-400 transition-colors">
              Beranda
            </Link>
            <span>•</span>
            <span className="font-mono text-cyan-400">
              Phase 8 • SEO & Discoverability
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
