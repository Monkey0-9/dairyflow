'use client';

import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function MemberProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [meta, setMeta] = useState<any>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/customer/profile');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Load failed (${res.status}).`);
      const p = data.profile;
      setMeta(p);
      setName(p.name || ''); setPhone(p.phone || '');
      setEmail(p.email || ''); setAddress(p.deliveryAddress || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load profile.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!name.trim() && !phone.trim() && !address.trim() && !email.trim()) {
      setError('Change at least one field before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(address.trim() ? { deliveryAddress: address.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Save failed (${res.status}).`);
      setSuccess('Profile updated successfully.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-xs text-slate-500 font-mono">Loading your profile…</div>;

  return (
    <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">My Profile</h1>
        <p className="text-xs text-slate-500 mt-1">Update your contact details. Subscription, farmer assignment and status are managed by the estate.</p>
      </div>
      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{success}</span></div>}
      {meta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"><div className="text-[10px] text-slate-400 font-bold uppercase">Daily Qty</div><div className="font-mono font-bold">{meta.dailyQuantity} L</div></div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"><div className="text-[10px] text-slate-400 font-bold uppercase">Milk Type</div><div className="font-bold">{meta.milkType}</div></div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"><div className="text-[10px] text-slate-400 font-bold uppercase">Status</div><div className="font-bold">{meta.status}</div></div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"><div className="text-[10px] text-slate-400 font-bold uppercase">Transfer</div><div className="font-bold">{meta.transferStatus}</div></div>
        </div>
      )}
      <form onSubmit={handleSave} className="space-y-4">
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" leftIcon={<User className="w-4 h-4" />} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" leftIcon={<Phone className="w-4 h-4" />} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.in" leftIcon={<Mail className="w-4 h-4" />} />
        </div>
        <Input label="Delivery Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat, street, area" leftIcon={<MapPin className="w-4 h-4" />} />
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => void load()} className="flex-1">Reload</Button>
          <Button type="submit" variant="primary" isLoading={saving} className="flex-1" leftIcon={<Save className="w-4 h-4" />}>Save Profile</Button>
        </div>
      </form>
    </div>
  );
}

export default MemberProfile;
