'use client';

import React from 'react';
import { Droplets, ShieldCheck, ArrowLeft, Mail, UserPlus, PhoneCall } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-4">
          <Droplets className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>Milk</span>
          <span className="text-emerald-400">Flow</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          Enterprise Dairy Operations &amp; Customer Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 text-slate-900 border border-slate-200/40 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Onboarding by Invitation Only
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              To protect dairy quality and route scheduling, customer accounts are created directly by your dairy administrator or local farmer.
            </p>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <UserPlus className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Step 1: Farmer Onboarding</strong>
                <p className="text-[11px] text-slate-500">Your farmer assigns your milk subscription, daily litres, and route sequence.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Step 2: Invitation Link</strong>
                <p className="text-[11px] text-slate-500">You receive a secure activation link via WhatsApp or SMS.</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Step 3: Account Activation</strong>
                <p className="text-[11px] text-slate-500">Set your password on the activation screen and access your customer portal.</p>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center space-y-3">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
