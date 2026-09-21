'use client';

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  code?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  code,
  onDismiss,
  onRetry,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 flex items-start justify-between gap-3 shadow-lg shadow-rose-950/20 animate-fade-in">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium leading-relaxed">{message}</p>
          {code && (
            <p className="text-[10px] font-mono text-rose-400/80 mt-1 uppercase">
              Kode Error: {code}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1.5 flex-shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900/50 transition-colors"
            title="Coba Lagi"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900/50 transition-colors"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
