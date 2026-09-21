import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getBaseUrl } from "@/lib/seo/platform-seo-data";
import { WebSiteJsonLd } from "@/components/seo-structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Tempelink — Universal Media Utility & Downloader",
    template: "%s | Tempelink",
  },
  description:
    "Unduh video, audio, dan media dari TikTok, Instagram, YouTube, X, Facebook, dan Pinterest dengan resolusi terverifikasi tanpa iklan jebakan.",
  keywords: [
    "universal media downloader",
    "tiktok downloader",
    "instagram reels downloader",
    "youtube shorts downloader",
    "x video downloader",
    "pinterest media downloader",
    "download video hd",
  ],
  authors: [{ name: "Tempelink Team" }],
  creator: "Tempelink",
  publisher: "Tempelink",
  alternates: {
    canonical: baseUrl,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Tempelink — Universal Media Utility & Downloader",
    description:
      "Unduh video, audio, dan foto dari berbagai platform secara cepat, bersih, dan jujur.",
    url: baseUrl,
    siteName: "Tempelink",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempelink — Universal Media Utility & Downloader",
    description: "Unduh media dari platform favorit Anda tanpa manipulasi resolusi.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

import { AppProvider } from "@/lib/context/app-context";

export const viewport: Viewport = {
  themeColor: "#233D4D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-app-main text-app-main font-sans transition-colors duration-200">
        <WebSiteJsonLd
          url={baseUrl}
          name="Tempelink"
          description="Universal Media Utility & Downloader"
        />
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
