'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AuthCard } from '@/components/ui/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export default function TokenActivationPage() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/activate-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Activation failed. Token may have expired or already been redeemed.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setError('A secure connection could not be established. Please retry.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard>
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Private Reserve Activated</h2>
          <p className="text-xs text-slate-400 mt-2">
            Your cryptographic key has been established. Redirecting to sign in...
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition"
            >
              <span>Continue to Member Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-white tracking-tight">Set Up Private Access</h1>
        <p className="text-xs text-slate-400 mt-1">
          Complete your private reserve invitation setup
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Invitation Token</label>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-300 truncate">
            {token || 'Pending invitation link'}
          </div>
        </div>

        <Input
          label="New Master Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat master password"
          required
        />

        {error && <ErrorBanner message={error} />}

        <Button type="submit" variant="primary" isLoading={loading} className="w-full">
          Activate Private Reserve Account
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-800 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>scrypt Key Derivation Protected</span>
        </div>
      </div>
    </AuthCard>
  );
}
