import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'emerald' | 'gold' | 'luxury' | 'live';
  className?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ children, variant = 'neutral', className = '', size = 'sm', dot = false }: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  }[size];

  const variantStyles = {
    success: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 font-bold',
    warning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    danger:  'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    info:    'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    gold:    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    luxury:  'bg-slate-900 text-amber-300 border-amber-500/30 font-bold',
    live:    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  }[variant];

  const dotColor = {
    success: 'bg-emerald-500',
    emerald: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger:  'bg-rose-500',
    info:    'bg-blue-500',
    neutral: 'bg-slate-400',
    gold:    'bg-amber-500',
    luxury:  'bg-amber-400',
    live:    'bg-emerald-500',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tracking-tight rounded-full border select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-status-pulse ${dotColor}`} />
      )}
      {children}
    </span>
  );
}
