import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

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
      role="alert"
      className={`rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-rose-900 dark:text-rose-300 flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-px" />
        <p className="text-xs font-medium leading-relaxed wrap-break-word">{message}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Retry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
            title="Dismiss"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
