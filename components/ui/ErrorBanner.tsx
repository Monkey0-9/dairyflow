import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({ message, onRetry, onDismiss, className = '' }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className={`rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 flex items-start justify-between gap-3 shadow-2xs animate-in fade-in duration-150 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="text-xs font-semibold leading-relaxed break-words">{message}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
