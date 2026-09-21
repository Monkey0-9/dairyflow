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
  LayoutGrid,
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
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-900">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-slate-950 dark:bg-slate-900 flex items-center justify-center border border-slate-800 dark:border-slate-700 group-hover:border-emerald-700 transition">
              <Droplets className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Milk<span className="text-emerald-700 dark:text-emerald-400">Flow</span>
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                  Private Reserve
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500">
                Single-Estate Asset Management
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <LanguageToggle compact />

            {session ? (
              <Link
                href={session.role === 'FARMER' ? '/admin' : session.role === 'CUSTOMER' ? '/customer' : '/superadmin'}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <span>Access Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/activate"
                  className="hidden sm:inline-flex px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  Activate Token
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-white dark:text-emerald-100 text-xs font-semibold rounded-xl border border-slate-800 dark:border-emerald-800/80 shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Executive Hero */}
        <section className="relative pt-20 pb-24 sm:pt-28 sm:pb-32 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Single-Origin Cold-Chain Provenance</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 dark:text-white leading-[1.1]">
                Private Dairy Assets.{' '}
                <span className="bg-linear-to-r from-emerald-700 via-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                  Cryptographically Proven.
                </span>
              </h1>

              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed font-normal max-w-2xl mx-auto">
                Purpose-built governance for distinguished estate owners and member households.
                Real-time yield reconciliation, white-glove doorstep concierge, and verifiable audit records.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
                >
                  <span>Enter Member Reserve</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/activate"
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Redeem Invitation Token</span>
                </Link>
              </div>
            </div>

            {/* Institutional Metrics Strip */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
              {[
                {
                  icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
                  label: 'AUM Volume',
                  value: '100%',
                  sub: 'Direct from pasture-fed estates',
                },
                {
                  icon: <FileCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
                  label: 'Settlement Rate',
                  value: '99.8%',
                  sub: 'Automated UPI & bank reconciliation',
                },
                {
                  icon: <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
                  label: 'Audit Assurance',
                  value: 'SHA-256',
                  sub: 'Tamper-evident append-only chain',
                  mono: true,
                },
                {
                  icon: <Award className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
                  label: 'Access Model',
                  value: 'Invitation',
                  sub: 'Private key client onboarding',
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80"
                >
                  <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    {metric.icon}
                    <span>{metric.label}</span>
                  </div>
                  <div className={`mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums ${metric.mono ? 'font-mono text-lg' : ''}`}>
                    {metric.value}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{metric.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Three Portal Entry Points */}
        <section className="py-20 sm:py-28 bg-white dark:bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center space-y-2 mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Institutional Architecture
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Engineered for Estate Owners and Discerning Clients
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: <LayoutGrid className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />,
                  iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
                  title: 'Private Client Concierge',
                  description:
                    'Doorstep fulfillment tracking, vacation hold controls, UPI settlement, and cryptographically verified monthly statement generation.',
                  link: '/customer',
                  linkLabel: 'Enter Client Suite',
                  accent: 'hover:border-emerald-500/30',
                  linkColor: 'text-emerald-700 dark:text-emerald-400',
                },
                {
                  icon: <TrendingUp className="w-5 h-5 text-amber-700 dark:text-amber-400" />,
                  iconBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
                  title: 'Estate Operations & AUM',
                  description:
                    'Live delivery confirmation, morning route oversight, automated price tiering, customer churn alerts, and daily production reconciliation.',
                  link: '/admin',
                  linkLabel: 'Open Owner Portal',
                  accent: 'hover:border-amber-400/30',
                  linkColor: 'text-amber-700 dark:text-amber-400',
                },
                {
                  icon: <ShieldCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />,
                  iconBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
                  title: 'Ledger Assurance & Governance',
                  description:
                    'Deterministic SHA-256 block ledger. Verification certificate generation, historical audit logs, and zero-trust multi-tenant isolation.',
                  link: '/superadmin',
                  linkLabel: 'View Governance',
                  accent: 'hover:border-blue-400/30',
                  linkColor: 'text-blue-700 dark:text-blue-400',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`p-7 rounded-2xl bg-[#FBFBFC] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 ${card.accent} transition flex flex-col justify-between gap-6`}
                >
                  <div className="space-y-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.iconBg}`}>
                      {card.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                  <Link
                    href={card.link}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${card.linkColor} hover:underline`}
                  >
                    <span>{card.linkLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cryptographic Security Assurance */}
        <section className="py-20 border-t border-slate-200/70 dark:border-slate-800/70 bg-slate-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Institutional Security Blueprint</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight leading-snug">
                  Zero Trust Architecture.<br />
                  Verified on PostgreSQL.
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Every interaction across MilkFlow is secured by industry-standard cryptography. No client-side ledger bypasses or synthetic fallbacks.
                </p>
                <div className="space-y-3 text-sm text-slate-300">
                  {[
                    {
                      title: 'Scrypt Key Derivation',
                      body: 'Passwords hashed with high-cost salt vectors. Zero plaintext credentials.',
                    },
                    {
                      title: 'HMAC-SHA256 Session Seals',
                      body: 'Tamper-proof cookie session tokens verified server-side.',
                    },
                    {
                      title: 'Append-Only Audit Blocks',
                      body: 'Sensitive delivery and billing changes form a cryptographic hash sequence.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-white">{item.title}</strong>: {item.body}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-300 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-500">
                  <span>AUDIT_MERKLE_CHAIN_PROVE</span>
                  <span className="text-emerald-400 font-semibold tracking-wide">VERIFIED</span>
                </div>
                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="text-slate-500">{'// Transaction Genesis Hash'}</div>
                  <div className="text-amber-300/90 break-all font-medium">
                    block_001: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
                  </div>
                  <div className="text-slate-500 pt-1">{'// Sequential Deliveries Seal'}</div>
                  <div className="text-slate-300 break-all">
                    block_002: 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
                  </div>
                  <div className="text-slate-500 pt-1">{'// Chain Status'}</div>
                  <div className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-status-pulse" />
                    Continuous · 0 Forks Detected · Neon PostgreSQL Authoritative
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">MilkFlow Private Reserve</span>
            <span>—</span>
            <span>Institutional Dairy Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Sign In</Link>
            <Link href="/activate" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Activate Token</Link>
            <Link href="/superadmin" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Governance</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
