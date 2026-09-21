'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Droplets,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';
import { ComprehensiveForecast } from '@/lib/ai-forecasting';
import AICopilotModal from './AICopilotModal';

export default function AIForecastingView() {
  const [forecast, setForecast] = useState<ComprehensiveForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCopilot, setShowCopilot] = useState(false);

  const tomorrowStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  useEffect(() => {
    fetch('/api/forecast')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setForecast(data.forecast);
        } else {
          console.error('[AIForecastingView] Forecast API error:', data.error);
        }
      })
      .catch((err) => console.error('[AIForecastingView] Failed to load forecast:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !forecast) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        <Sparkles className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
        <div>Computing AI milk yield & customer consumption projections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>AI Milk Demand & Production Predictor</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Machine-learning driven forecast synthesizing subscription curves, vacation schedules, and weekend shifts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCopilot(true)}
            className="text-xs bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            Ask AI Copilot
          </button>
          <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full font-bold">
            Target: Tomorrow ({tomorrowStr})
          </span>
        </div>
      </div>
      {showCopilot && <AICopilotModal onClose={() => setShowCopilot(false)} />}

      {/* Main Tomorrow Prediction Hero Card */}
      <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        {/* Glow orb */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2 space-y-4">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full">
              Production Plan Recommendation
            </span>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Tomorrow Expected Demand:{' '}
              <span className="text-emerald-400 font-mono">{forecast.tomorrowDemand} Litres</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Recommended milking target is{' '}
              <span className="font-bold text-white">{forecast.recommendedMilkingTarget} L</span>{' '}
              (including a <span className="text-amber-300 font-semibold">{forecast.safetyBufferLitres} L</span>{' '}
              contingency safety buffer) to satisfy all scheduled deliveries without stockouts.
            </p>

            {/* Product breakdown badges */}
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                <span>Cow Milk: <strong>{forecast.cowMilkDemand} L</strong></span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                <span>Buffalo Milk: <strong>{forecast.buffaloMilkDemand} L</strong></span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-amber-400" />
                <span>A2 Desi Cow: <strong>{forecast.a2MilkDemand} L</strong></span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-3 text-xs">
            <div className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              AI System Insights
            </div>
            {forecast.insightNotes.slice(0, 3).map((note, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7-Day Forward Forecast Table / Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          7-Day Forward Demand Trend (17 Sep – 23 Sep)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
          {forecast.sevenDayForecast.map((item, idx) => {
            const isWeekend = item.dayName === 'Saturday' || item.dayName === 'Sunday';

            return (
              <div
                key={item.date}
                className={`bg-white rounded-2xl p-4 border transition hover:shadow-md flex flex-col justify-between ${
                  idx === 0
                    ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                    : isWeekend
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-800">{item.dayName.substring(0, 3)}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.date.split('-').slice(1).join('/')}
                    </span>
                  </div>

                  <div className="text-xl font-black text-slate-900 font-mono mt-2">
                    {item.predictedDemandLitres}{' '}
                    <span className="text-xs font-normal text-slate-400">L</span>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-1">
                    Base: {item.baseScheduledLitres} L
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100">
                  <div className="text-[9px] text-slate-400 font-mono">
                    Confidence: {item.confidenceScore}%
                  </div>
                  {item.vacationLossLitres > 0 && (
                    <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                      -{item.vacationLossLitres}L Vacation
                    </div>
                  )}
                  {item.extraRequestsLitres > 0 && (
                    <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      +{item.extraRequestsLitres}L Extra Guests
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Churn & Anomaly Detection */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Anomaly & Churn Risk Detection
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {forecast.anomalies.map((a, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex items-start gap-3.5"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  a.severity === 'HIGH'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{a.customerName}</h4>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      a.severity === 'HIGH'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {a.severity} Priority Risk
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
