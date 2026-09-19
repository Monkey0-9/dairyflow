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
      className={`rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-xs ${
        hover ? 'hover-lift hover:border-slate-300' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 pt-6 pb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={`text-base font-black text-slate-900 tracking-tight ${className}`}>{children}</h3>;
}

export function CardDescription({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <p className={`text-xs text-slate-500 mt-1 leading-relaxed ${className}`}>{children}</p>;
}

export function CardContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 py-2 ${className}`}>{children}</div>;
}

export function CardFooter({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-6 pb-6 pt-4 border-t border-slate-100 mt-4 flex items-center ${className}`}>{children}</div>;
}
