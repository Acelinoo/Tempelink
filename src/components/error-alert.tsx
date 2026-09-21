'use client';

import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useApp } from '@/lib/context/app-context';

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
  const { t } = useApp();

  return (
    <div className="w-full max-w-2xl mx-auto p-4 rounded-xl bg-rose-950/20 border border-rose-700/50 text-rose-300 flex items-start justify-between gap-3 shadow-md animate-fade-in">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold leading-relaxed text-rose-200">{message}</p>
          {code && (
            <p className="text-[10px] font-mono text-rose-400 mt-1 uppercase">
              Code: {code}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1.5 flex-shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900/40 transition-colors cursor-pointer"
            title={t('btnRetry')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900/40 transition-colors cursor-pointer"
            title={t('btnClose')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
