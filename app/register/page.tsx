'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Droplets, ShieldCheck, ArrowRight, UserCheck, CheckCircle2, Phone, Home, Sparkles, Clock } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    productId: 'prod_cow_milk',
    quantity: '1.0',
    deliveryShift: 'MORNING',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!formData.name || !formData.phone || !formData.address) {
      setError('Please fill in your name, mobile phone, and delivery address.');
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
        router.push(data.redirectUrl || '/customer');
        router.refresh();
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          Delivered fresh to your doorstep every morning by <strong>GreenValley Dairy Farm</strong>. Automated digital monthly billing.
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Meera Patel"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone</label>
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

            {/* Delivery Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Complete Delivery Address & Flat Number
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
                Your subscription will be serviced by <strong>GreenValley Dairy Farm</strong> (Plot 42, Anand).
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Creating Your Account...' : 'Complete Registration & Start Delivery'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Link to Login */}
          <div className="mt-4 pt-3 text-center border-t border-slate-100">
            <p className="text-xs text-slate-600">
              Already have an account?{' '}
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
