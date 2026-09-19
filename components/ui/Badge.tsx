import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'emerald' | 'gold' | 'luxury';
  className?: string;
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', className = '', size = 'sm' }: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  }[size];

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
    info: 'bg-blue-50 text-blue-800 border-blue-200/80',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    gold: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-black',
    luxury: 'bg-slate-900 text-amber-300 border-amber-500/40 font-black',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 font-extrabold uppercase tracking-wide rounded-full border shadow-2xs select-none ${sizeStyles} ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}
