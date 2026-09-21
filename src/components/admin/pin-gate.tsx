'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PinGateProps {
  onSuccess: () => void;
}

export const PinGate: React.FC<PinGateProps> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || locked || !pin) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
      } else {
        if (res.status === 429) setLocked(true);
        setError(data.error || 'PIN tidak valid.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Koneksi gagal. Periksa jaringan Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border p-8 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--card-shadow)',
          }}>
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
              <Lock className="w-5 h-5" style={{ color: 'var(--accent-cta)' }} />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold text-center mb-1" style={{ color: 'var(--text-main)' }}>
            Admin Access
          </h1>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-subtle)' }}>
            Masukkan PIN admin untuk melanjutkan
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="••••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                disabled={loading || locked}
                className="w-full px-4 py-3 rounded-xl text-center text-xl font-bold tracking-[0.5em] outline-none transition-all"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: `1.5px solid ${error ? '#EF4444' : 'var(--border-subtle)'}`,
                  color: 'var(--text-main)',
                  fontFamily: 'monospace',
                }}
                aria-label="Admin PIN"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: '#EF4444' }} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || locked || pin.length < 4}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                backgroundColor: loading || locked || pin.length < 4
                  ? 'var(--border-subtle)'
                  : 'var(--accent-cta)',
                color: loading || locked || pin.length < 4
                  ? 'var(--text-subtle)'
                  : 'var(--accent-cta-text)',
                cursor: loading || locked || pin.length < 4 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Memeriksa...' : locked ? 'Terkunci' : 'Masuk'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-xs text-center mt-6" style={{ color: 'var(--text-subtle)' }}>
            Tempelink Admin · Monitoring Dashboard
          </p>
        </div>
      </div>
    </div>
  );
};
