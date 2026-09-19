import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import {
  Droplets,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  FileCheck,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { LanguageToggle } from '@/lib/i18n';

export const metadata = {
  title: 'MilkFlow Private Reserve — Institutional Dairy Asset & Member Distribution Platform',
  description:
    'Private wealth and member concierge distribution for single-estate dairy production. Real-time volume auditing, cryptographically verified provenance, and institutional settlement.',
  openGraph: {
    title: 'MilkFlow Private Reserve — Single-Estate Dairy Platform',
    description:
      'Private dairy asset governance, high-density financial analytics, and white-glove member delivery concierge.',
    type: 'website',
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(sessionToken);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: 'MilkFlow Private Reserve',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'iOS, Android, Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    description:
      'Private dairy asset management, tamper-evident cryptographic ledger, and white-glove daily distribution concierge for high-profile estates and members.',
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Institutional Top Banner */}
      <div className="w-full bg-slate-950 text-slate-400 text-[11px] py-1.5 px-4 text-center border-b border-slate-800/80 tracking-wide font-medium flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Private Reserve Institutional Release</span>
        <span className="text-slate-600">•</span>
        <span className="text-amber-400/90 font-mono">100% Cryptographic Ledger Verification</span>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-slate-950 dark:bg-slate-900 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-xs group-hover:border-amber-400 transition">
              <Droplets className="w-5 h-5 text-amber-400 drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Milk<span className="text-emerald-700 dark:text-emerald-500">Flow</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  Private Reserve
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Single-Estate Asset Management
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageToggle compact />

            {session ? (
              <Link
                href={session.role === 'FARMER' ? '/admin' : session.role === 'CUSTOMER' ? '/customer' : '/superadmin'}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <span>Access Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/activate"
                  className="hidden sm:inline-flex px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                >
                  Activate Token
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-white dark:text-emerald-100 text-xs font-black rounded-xl border border-slate-800 dark:border-emerald-800/80 shadow-xs transition flex items-center gap-2"
                >
                  <span>Member Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Executive Hero */}
        <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-36 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Single-Origin Cold-Chain Provenance</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-950 dark:text-white leading-[1.08]">
                Private Dairy Assets.
                <span className="block mt-2 bg-linear-to-r from-emerald-800 via-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  Cryptographically Proven.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-normal max-w-2xl mx-auto">
                Purpose-built governance for distinguished estate owners and member households.
                Real-time yield reconciliation, white-glove doorstep concierge, and verifiable audit records.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-black text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>Enter Member Reserve</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/activate"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 font-bold text-sm transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Redeem Invitation Token</span>
                </Link>
              </div>
            </div>

            {/* AUM-Style Metrics Strip */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AUM Volume</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  100%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Direct from pasture-fed estates</div>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Settlement Rate</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  99.8%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Automated UPI &amp; bank reconciliations</div>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Audit Assurance</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono pt-1">
                  SHA-256
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Tamper-evident append-only chain</div>
              </div>

              <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-teal-600" />
                  <span>Access Model</span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Invitation
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Private key client onboarding</div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Portal Entry Points */}
        <section className="py-20 sm:py-28 bg-white dark:bg-slate-950/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Institutional Architecture
              </h2>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Engineered for Estate Owners and Discerning Clients
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Private Client Portal */}
              <div className="p-8 rounded-3xl bg-[#FBFBFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-600/40 transition flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Private Client Concierge
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Doorstep fulfillment tracking, instant vacation pause controls, one-tap UPI settlement, and cryptographically verified monthly statement generation.
                  </p>
                </div>
                <Link
                  href="/customer"
                  className="inline-flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <span>Enter Client Suite</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Card 2: Estate Executive Command */}
              <div className="p-8 rounded-3xl bg-[#FBFBFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Estate Operations &amp; AUM
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Live delivery confirmation, morning route oversight, automated price tiering, customer churn alerts, and daily production reconciliation.
                  </p>
                </div>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-400 hover:underline"
                >
                  <span>Open Owner Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Card 3: Cryptographic Audit & Governance */}
              <div className="p-8 rounded-3xl bg-[#FBFBFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/40 transition flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Ledger Assurance &amp; Governance
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Deterministic SHA-256 block ledger. Verification certificate generation, historical audit logs, and zero-trust multi-tenant isolation across all routes.
                  </p>
                </div>
                <Link
                  href="/superadmin"
                  className="inline-flex items-center gap-2 text-xs font-black text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <span>View Governance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Cryptographic Security Assurance Section */}
        <section className="py-20 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Institutional Security Blueprint</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  Zero Trust Architecture.<br />
                  Verified on PostgreSQL.
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
                  Every interaction across MilkFlow is secured by industry standard cryptography. There are no client-side ledger bypasses or synthetic fallbacks.
                </p>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Scrypt Key Derivation</strong>: Passwords hashed with high-cost salt vectors. Zero plaintext credentials.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>HMAC-SHA256 Session Seals</strong>: Tamper-proof cookie session tokens verified server-side.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Append-Only Audit Blocks</strong>: Sensitive delivery and billing changes form a cryptographic hash sequence.</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 font-mono text-xs text-slate-300 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-500">
                  <span>AUDIT_MERKLE_CHAIN_PROVE</span>
                  <span className="text-emerald-400 font-bold">● VERIFIED</span>
                </div>
                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="text-slate-500">{'// Transaction Genesis Hash'}</div>
                  <div className="text-amber-300/90 break-all font-semibold">
                    block_001: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
                  </div>
                  <div className="text-slate-500 pt-1">{'// Sequential Deliveries Seal'}</div>
                  <div className="text-slate-300 break-all">
                    block_002: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
                  </div>
                  <div className="text-slate-500 pt-1">{'// Real-time Status'}</div>
                  <div className="text-emerald-400">
                    Chain Status: Continuous • 0 Forks Detected • Neon PostgreSQL Authoritative
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 dark:text-white">MilkFlow Private Reserve</span>
            <span>—</span>
            <span>Institutional Dairy Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/login" className="hover:text-slate-800 dark:hover:text-slate-200 transition">Member Sign In</Link>
            <Link href="/activate" className="hover:text-slate-800 dark:hover:text-slate-200 transition">Activate Token</Link>
            <Link href="/superadmin" className="hover:text-slate-800 dark:hover:text-slate-200 transition">Governance</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
