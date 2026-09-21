'use client';

export interface DownloadHistoryItem {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
  capabilityLabel: string;
  format: string;
  downloadedAt: string;
  sourceUrl: string;
}

const STORAGE_KEY = 'tempelink_anonymous_history_v1';
const MAX_HISTORY_ITEMS = 30;

function notifyChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tempelink_history_change'));
  }
}

export function subscribeHistory(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('tempelink_history_change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('tempelink_history_change', callback);
  };
}

export function getHistorySnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return window.localStorage.getItem(STORAGE_KEY) || '[]';
}

export function getServerHistorySnapshot(): string {
  return '[]';
}

export function getLocalHistory(): DownloadHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalHistoryItem(
  item: Omit<DownloadHistoryItem, 'id' | 'downloadedAt'>
): DownloadHistoryItem {
  if (typeof window === 'undefined') {
    return {
      ...item,
      id: String(Date.now()),
      downloadedAt: new Date().toISOString(),
    };
  }

  const existing = getLocalHistory();
  const newItem: DownloadHistoryItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    downloadedAt: new Date().toISOString(),
  };

  const updated = [
    newItem,
    ...existing.filter(
      (i) =>
        i.sourceUrl !== item.sourceUrl || i.capabilityLabel !== item.capabilityLabel
    ),
  ].slice(0, MAX_HISTORY_ITEMS);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {
    // Storage quota exceeded or disabled
  }

  return newItem;
}

export function removeLocalHistoryItem(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = getLocalHistory();
  const updated = existing.filter((i) => i.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {
    // Storage quota exceeded
  }
}

export function clearLocalHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyChange();
  } catch {
    // Storage quota exceeded
  }
}
