import React from 'react';
import { Droplets } from 'lucide-react';

export function AuthCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 text-slate-100">
      <div className={`w-full max-w-md bg-slate-900/95 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md ${className}`}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
            <Droplets className="w-6 h-6" />
          </div>
          <span className="text-xs uppercase font-mono tracking-widest text-amber-400">
            MilkFlow Private Reserve
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default AuthCard;
