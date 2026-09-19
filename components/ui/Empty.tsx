import React from 'react';

export interface EmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({ icon, title, description, action, className = '' }: EmptyProps) {
  return (
    <div className={`rounded-3xl border border-dashed border-slate-800/80 bg-slate-900/40 p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <h4 className="text-base font-bold text-white tracking-tight">{title}</h4>
      {description && <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default Empty;
