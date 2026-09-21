import React from 'react';

export function Card({
  className = '',
  children,
  hover = true,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 shadow-sm ${
        hover ? 'hover-lift hover:border-slate-300 dark:hover:border-slate-700' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 pt-5 pb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={`text-sm font-bold text-slate-900 dark:text-white tracking-tight ${className}`}>{children}</h3>;
}

export function CardDescription({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <p className={`text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed ${className}`}>{children}</p>;
}

export function CardContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 py-2 ${className}`}>{children}</div>;
}

export function CardFooter({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 pb-5 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center ${className}`}>{children}</div>;
}
