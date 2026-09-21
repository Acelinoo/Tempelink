'use client';

import React, { useState, useEffect } from 'react';
import { PinGate } from '@/components/admin/pin-gate';
import { AdminDashboard } from '@/components/admin/dashboard';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // On mount: verify session with a lightweight ping
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        // Hit stats with page=1, size=1 — returns 401 if not authed
        const res = await fetch('/api/admin/stats?period=today', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!cancelled) {
          setIsAuthenticated(res.status !== 401);
        }
      } catch {
        if (!cancelled) setIsAuthenticated(false);
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  const handleSuccess = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  // Loading state while checking session
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-main)' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent-cta)', borderTopColor: 'transparent' }}
          aria-label="Memuat..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinGate onSuccess={handleSuccess} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
