'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplets,
  ArrowRight,
  CheckCircle2,
  Phone,
  Home,
  Sparkles,
  Clock,
  Lock,
  Mail,
  User,
  ShieldAlert,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    address: '',
    productId: 'prod_cow_milk',
    quantity: '1.0',
    deliveryShift: 'MORNING',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    phone: string;
    email: string;
    product: string;
    quantity: number;
    shift: string;
    address: string;
  } | null>(null);

  const products = [
    {
      id: 'prod_cow_milk',
      name: 'Fresh Cow Milk',
      price: 50,
      desc: '100% Pure, wholesome cow milk tested daily',
    },
    {
      id: 'prod_buffalo_milk',
      name: 'Rich Buffalo Milk',
      price: 70,
      desc: 'Creamy 7%+ fat milk for rich tea & sweets',
    },
    {
      id: 'prod_a2_milk',
      name: 'Desi Gir Cow A2 Milk',
      price: 85,
      desc: 'A2 certified Vedic pure desi cow milk',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.password || !formData.address) {
      setError('Please fill in your name, mobile phone, password, and delivery address.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setSubmittedData(data.clientDetails || {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          product: products.find((p) => p.id === formData.productId)?.name || 'Fresh Cow Milk',
          quantity: parseFloat(formData.quantity),
          shift: formData.deliveryShift,
          address: formData.address,
        });
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 text-slate-900 border border-emerald-500/30 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shadow-lg">
              <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                Pending Admin Approval
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">Registration Submitted!</h2>
              <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto">
                Thank you for applying for daily milk delivery. Your registration has been sent to <strong>Prakash Paraveen (Admin)</strong> for verification.
              </p>
            </div>

            {/* Application Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>Application Summary</span>
                <span className="text-emerald-700 font-mono">GreenValley Dairy</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Client Name</span>
                  <strong className="text-slate-900">{submittedData.name}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Mobile Phone</span>
                  <strong className="text-slate-900 font-mono">{submittedData.phone}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Product & Qty</span>
                  <strong className="text-slate-900">{submittedData.quantity}L &bull; {submittedData.product}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Delivery Shift</span>
                  <strong className="text-slate-900">{submittedData.shift === 'MORNING' ? 'Morning (6-8 AM)' : 'Evening (5-7 PM)'}</strong>
                </div>
              </div>
              <div className="pt-1 text-slate-600 text-[11px]">
                <span className="text-[10px] text-slate-400 block uppercase">Delivery Address</span>
                {submittedData.address}
              </div>
            </div>

            {/* Note on access */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5 text-left">
              <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Next Step:</strong> As soon as the admin accepts your registration, your account will be activated and you can sign in directly using your phone/email and password.
              </div>
            </div>

            {/* Go to Login Button */}
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-sm active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Go to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-3 animate-pulse">
          <Droplets className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>Register for Daily Milk Delivery</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400 font-medium max-w-md mx-auto">
          Delivered fresh to your doorstep every morning by <strong>GreenValley Dairy Farm</strong>. Reviewed and approved by dairy administration.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 text-slate-900 border border-slate-200/40">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Meera Patel"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 98234 56789"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. meera@gmail.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Create Password *</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min. 6 characters"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Complete Delivery Address & Flat Number *
              </label>
              <div className="relative">
                <Home className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Flat 401, Royal Palms, Station Road, Anand"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Milk Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Milk Product
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {products.map((p) => {
                  const isSelected = formData.productId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setFormData({ ...formData, productId: p.id })}
                      className={`p-3 rounded-2xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/80 shadow-xs'
                          : 'border-slate-200 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{p.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">
                        ₹{p.price} <span className="text-[10px] font-normal text-slate-500">/ Litre</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Quantity & Shift */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Daily Quantity (Litres / day)
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {['0.5', '1.0', '1.5', '2.0', '3.0'].map((qty) => (
                    <button
                      type="button"
                      key={qty}
                      onClick={() => setFormData({ ...formData, quantity: qty })}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        formData.quantity === qty
                          ? 'bg-slate-900 text-emerald-400 border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {qty} L
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Shift
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deliveryShift: 'MORNING' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      formData.deliveryShift === 'MORNING'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Morning (6-8 AM)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deliveryShift: 'EVENING' })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      formData.deliveryShift === 'EVENING'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Evening (5-7 PM)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Farm Assignment Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Your request will be sent to <strong>Prakash Paraveen (Admin)</strong> for acceptance & route setup.
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Submitting Registration...' : 'Submit Registration for Admin Approval'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Link to Login */}
          <div className="mt-4 pt-3 text-center border-t border-slate-100">
            <p className="text-xs text-slate-600">
              Already approved or have an account?{' '}
              <Link href="/login" className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                Sign in here →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
