'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="id">
      <head>
        <title>Terjadi Kesalahan — Tempelink</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: '24px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          color: '#F5F5F5',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '420px', width: '100%' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#005691',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 900,
              margin: '0 auto 16px',
            }}
          >
            T
          </div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: '0 0 8px',
              color: '#FFFFFF',
            }}
          >
            Terjadi Kesalahan
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#A0A0A0',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            Maaf, terjadi kendala teknis pada sistem. Silakan coba muat ulang halaman atau kembali ke beranda.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: '#005691',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.href = '/';
                }
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                backgroundColor: '#1A1A1A',
                color: '#F5F5F5',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #333333',
                cursor: 'pointer',
              }}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
