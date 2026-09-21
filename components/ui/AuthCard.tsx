import React from 'react';
import { Droplets } from 'lucide-react';

export function AuthCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 text-slate-900">
      <div className={`w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60 ${className}`}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
            <Droplets className="w-6 h-6" />
          </div>
          <span className="text-xs uppercase font-mono tracking-widest text-emerald-700 font-bold">
            MilkFlow Dairy Operations
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default AuthCard;

