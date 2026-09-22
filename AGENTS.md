<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TEMPELINK PROJECT & UI DESIGN RULES (MANDATORY)

## 1. Dilarang Menggunakan Pill Badges
- Dilarang keras menggunakan pill-shaped badge (`rounded-full` dengan teks/icon) di seluruh halaman website.
- Jika memerlukan badge status, tag, kategori, atau indikator:
  - Gunakan **kotak div bersih** (`rounded-md`, `rounded-lg`, border subtle, background subtle).
  - Gunakan **underline / border-bottom accent** (seperti pada platform selector).
  - Atau gunakan plain text typography (uppercase, tracking-wider, font-mono).
- Jangan pernah membuat elemen teks, badge, atau counter berbentuk kapsul / oval (`rounded-full`).

## 2. Dilarang Menggunakan Icon Dekoratif / AI Slop
- Dilarang keras menempelkan icon dekoratif / pemanis visual AI (seperti Sparkles `✦`, Stars, Wand, atau icon sembarangan pada badge, tombol aksi, atau judul section).
- Tombol aksi (CTA) dan badge harus bersih tanpa icon hiasan pemanis visual.
- Icon HANYA diizinkan jika memiliki fungsi interaksi / utilitas nyata (seperti navigasi panah, download file, copy clipboard, status spinner/check, close dialog).
