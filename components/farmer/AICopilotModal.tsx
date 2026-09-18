'use client';

import React, { useState } from 'react';
import { Sparkles, Send, Copy, Check, MessageCircle, X } from 'lucide-react';

interface CopilotCustomer {
  customerId: string;
  customerName: string;
  amount?: number;
  phone?: string;
  message?: string;
  whatsappUrl?: string | null;
  skips?: number;
}

const SUGGESTIONS = [
  'How much Buffalo milk do I need to procure for tomorrow morning?',
  'Which customers have unpaid bills older than 15 days?',
  'Show me customers who skipped more than 5 deliveries this month.',
];

export default function AICopilotModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(SUGGESTIONS[0]);
  const [answer, setAnswer] = useState<string>('');
  const [customers, setCustomers] = useState<CopilotCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [copied, setCopied] = useState<string | null>(null);

  const ask = async (q: string) => {
    setLoading(true);
    setAnswer('');
    setCustomers([]);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, lang }),
      });
      const data = await res.json();
      if (data.success) {
        setAnswer(data.answer || '');
        setCustomers(data.customers || []);
      } else {
        setAnswer(data.error || 'Copilot failed. Try again.');
      }
    } catch {
      setAnswer('Network error. Check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            AI Dairy Copilot
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white text-slate-400 hover:text-slate-700" aria-label="Close copilot">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition ${query === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'}`}
              >
                {s.slice(0, 42)}…
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(query);
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about demand, dues, skips…"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button type="submit" disabled={loading} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Thinking…' : 'Ask'}
            </button>
          </form>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Reminder language:</span>
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-lg border font-bold ${lang === l ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}
              >
                {l === 'en' ? 'English' : l === 'hi' ? 'हिंदी' : 'मराठी'}
              </button>
            ))}
          </div>

          {answer && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-slate-800 leading-relaxed">
              {answer}
            </div>
          )}

          {customers.length > 0 && (
            <div className="space-y-2">
              {customers.map((c) => (
                <div key={c.customerId} className="p-3 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900">{c.customerName}</div>
                    <div className="text-slate-500">
                      {c.amount !== undefined ? `Due ₹${c.amount}` : c.skips !== undefined ? `${c.skips} skips` : ''}
                    </div>
                    {c.message && <div className="mt-1 text-slate-600 italic">“{c.message}”</div>}
                  </div>
                  {c.message && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void copyText(c.customerId, c.message || '')}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold flex items-center gap-1"
                      >
                        {copied === c.customerId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === c.customerId ? 'Copied' : 'Copy'}
                      </button>
                      {c.whatsappUrl && (
                        <a
                          href={c.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Send Reminder
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
