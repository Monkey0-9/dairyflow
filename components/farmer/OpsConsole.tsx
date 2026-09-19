'use client';

import React, { useState, useEffect } from 'react';
import {
  Upload,
  GitMerge,
  ArrowRightLeft,
  Receipt,
  History,
  Layers,
  Route as RouteIcon,
  CalendarCheck,
  Power,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { CustomerProfile, Product, Invoice } from '@/lib/types';

interface OpsConsoleProps {
  customers: CustomerProfile[];
  products: Product[];
  invoices: Invoice[];
  onRefresh: () => void;
}

type ToolId =
  | 'import'
  | 'merge'
  | 'transfer'
  | 'adjust'
  | 'pricehist'
  | 'subver'
  | 'routes'
  | 'monthclose'
  | 'closures';

const TOOLS: { id: ToolId; label: string; desc: string }[] = [
  { id: 'import', label: 'Bulk Import', desc: 'CSV paste, dry-run preview, invite' },
  { id: 'merge', label: 'Merge Duplicates', desc: 'Combine duplicate client records' },
  { id: 'transfer', label: 'Transfer Client', desc: 'Move client between dairies' },
  { id: 'adjust', label: 'Credit / Debit Notes', desc: 'Invoice adjustments' },
  { id: 'pricehist', label: 'Price History', desc: 'Effective-dated rate changes' },
  { id: 'subver', label: 'Subscription Versions', desc: 'Plan change timeline' },
  { id: 'routes', label: 'Shift Routes', desc: 'Create & list delivery routes' },
  { id: 'monthclose', label: 'Month Closing', desc: 'Finalize & lock a month' },
  { id: 'closures', label: 'Holiday Closures', desc: 'Operational shutdown days' },
];

function Banner({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          <span className="font-bold">Not saved: </span>{error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-1.5" role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </>
  );
}

export default function OpsConsole({ customers, products, invoices, onRefresh }: OpsConsoleProps) {
  const [tool, setTool] = useState<ToolId>('import');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setError(null); setSuccess(null); };

  async function postJson(path: string, body: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) throw new Error(data?.error || `Request failed (${res.status}).`);
    return data;
  }

  // ---- Import state ----
  const [csvText, setCsvText] = useState('Ramesh Chandra, +91 98234 56789, Flat 101 Shanti Heights\nPriya Nair, +91 98111 22233, Plot 7 Green Avenue');
  const [preview, setPreview] = useState<any>(null);

  const parseCsv = () => {
    const rows = csvText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [name = '', phone = '', address = ''] = line.split(',').map((s) => s.trim());
      return { name, phone, address };
    });
    return rows;
  };

  const handleDryRun = async () => {
    reset(); setBusy(true);
    try {
      const rows = parseCsv();
      if (rows.length === 0) throw new Error('Paste at least one CSV row: Name, Phone, Address.');
      const data = await postJson('/api/admin/import-customers', { customers: rows, dryRun: true });
      setPreview(data);
      setSuccess(`Preview ready: ${data.validCount} valid, ${data.errorCount} errors.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview failed.'); }
    finally { setBusy(false); }
  };

  const handleImport = async () => {
    reset(); setBusy(true);
    try {
      const rows = parseCsv();
      const data = await postJson('/api/admin/import-customers', { customers: rows, dryRun: false });
      setSuccess(`Imported ${data.importedCount} customers with invitation tokens.`);
      setPreview(null);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  };

  // ---- Merge state ----
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!primaryId || !secondaryId) { setError('Select both primary and duplicate customers.'); return; }
    if (primaryId === secondaryId) { setError('Cannot merge a customer into itself.'); return; }
    setBusy(true);
    try {
      const data = await postJson('/api/admin/merge-customers', { primaryCustomerId: primaryId, secondaryCustomerId: secondaryId });
      setSuccess(data.message || 'Customers merged.');
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Merge failed.'); }
    finally { setBusy(false); }
  };

  // ---- Transfer state ----
  const [transferCust, setTransferCust] = useState('');
  const [toFarmer, setToFarmer] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferId, setTransferId] = useState('');
  const [transferAction, setTransferAction] = useState<'APPROVE' | 'ACCEPT' | 'REJECT'>('APPROVE');

  const handleTransferInit = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!transferCust || !toFarmer) { setError('Customer and destination farmer ID are required.'); return; }
    setBusy(true);
    try {
      const data = await postJson('/api/customer/transfer', { customerId: transferCust, toFarmerId: toFarmer, reason: transferReason || undefined });
      setTransferId(data.transferId || data.transferRequest?.id || '');
      setSuccess(`Transfer initiated (${data.transferId || 'pending'}). Approve / accept to complete.`);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Transfer failed.'); }
    finally { setBusy(false); }
  };

  const handleTransferStep = async () => {
    reset();
    if (!transferId) { setError('Enter the transfer request ID first.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/customer/transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId, action: transferAction }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `Step failed (${res.status}).`);
      setSuccess(data.message || `${transferAction} done.`);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Step failed.'); }
    finally { setBusy(false); }
  };

  // ---- Adjustments ----
  const [adjInvoice, setAdjInvoice] = useState('');
  const [adjType, setAdjType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    const amt = parseFloat(adjAmount);
    if (!adjInvoice) { setError('Select an invoice.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Amount must be greater than ₹0.'); return; }
    if (!adjReason.trim()) { setError('A reason is required for audit.'); return; }
    setBusy(true);
    try {
      const data = await postJson('/api/invoices/adjustments', { invoiceId: adjInvoice, type: adjType, amount: amt, reason: adjReason.trim() });
      setSuccess(data.message || 'Adjustment applied.');
      setAdjAmount(''); setAdjReason('');
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Adjustment failed.'); }
    finally { setBusy(false); }
  };

  // ---- Price history ----
  const [phProduct, setPhProduct] = useState('');
  const [phPrice, setPhPrice] = useState('');
  const [phFrom, setPhFrom] = useState('');
  const [phTo, setPhTo] = useState('');
  const [phList, setPhList] = useState<any[]>([]);

  const loadPriceHist = async (pid: string) => {
    if (!pid) return;
    try {
      const res = await fetch(`/api/products/price-history?productId=${pid}`);
      const data = await res.json().catch(() => null);
      if (data?.success) setPhList(data.priceHistories || []);
    } catch { /* best effort */ }
  };

  useEffect(() => { if (tool === 'pricehist' && phProduct) void loadPriceHist(phProduct); }, [tool, phProduct]);

  const handlePriceHist = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    const p = parseFloat(phPrice);
    if (!phProduct) { setError('Select a product.'); return; }
    if (!Number.isFinite(p) || p < 0) { setError('Price must be a non-negative number.'); return; }
    if (!phFrom) { setError('Effective-from date is required.'); return; }
    setBusy(true);
    try {
      await postJson('/api/products/price-history', {
        productId: phProduct, pricePerUnit: p,
        effectiveFrom: new Date(phFrom).toISOString(),
        effectiveTo: phTo ? new Date(phTo).toISOString() : undefined,
      });
      setSuccess('Price history entry created.');
      await loadPriceHist(phProduct);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  };

  // ---- Subscription versions ----
  const [svCustomer, setSvCustomer] = useState('');
  const [svProduct, setSvProduct] = useState('');
  const [svQty, setSvQty] = useState('1.0');
  const [svFrom, setSvFrom] = useState('');
  const [svList, setSvList] = useState<any[]>([]);

  const loadSubVer = async (cid: string) => {
    if (!cid) return;
    try {
      const res = await fetch(`/api/subscriptions/versions?customerId=${cid}`);
      const data = await res.json().catch(() => null);
      if (data?.success) setSvList(data.subscriptionVersions || []);
    } catch { /* best effort */ }
  };

  useEffect(() => { if (tool === 'subver' && svCustomer) void loadSubVer(svCustomer); }, [tool, svCustomer]);

  const handleSubVer = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    const q = parseFloat(svQty);
    if (!svCustomer || !svProduct) { setError('Customer and product are required.'); return; }
    if (!Number.isFinite(q) || q <= 0 || q > 50) { setError('Quantity must be 0.5–50 L.'); return; }
    if (!svFrom) { setError('Effective-from date is required.'); return; }
    setBusy(true);
    try {
      await postJson('/api/subscriptions/versions', {
        subscriptionId: `sub_${svCustomer}_${Date.now()}`,
        customerId: svCustomer, productId: svProduct, quantity: q,
        frequency: 'DAILY', shift: 'MORNING',
        effectiveFrom: new Date(svFrom).toISOString(),
      });
      setSuccess('Subscription version recorded.');
      await loadSubVer(svCustomer);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setBusy(false); }
  };

  // ---- Routes ----
  const [routeName, setRouteName] = useState('');
  const [routeCode, setRouteCode] = useState('');
  const [routeShift, setRouteShift] = useState('MORNING');
  const [routeList, setRouteList] = useState<any[]>([]);

  const loadRoutes = async () => {
    try {
      const res = await fetch('/api/routes');
      const data = await res.json().catch(() => null);
      if (data?.success) setRouteList(data.routes || []);
    } catch { /* best effort */ }
  };

  useEffect(() => { if (tool === 'routes') void loadRoutes(); }, [tool]);

  const handleRoute = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!routeName.trim() || !routeCode.trim()) { setError('Route name and code are required.'); return; }
    setBusy(true);
    try {
      await postJson('/api/routes', { name: routeName.trim(), code: routeCode.trim().toUpperCase(), shift: routeShift });
      setSuccess('Route created.');
      setRouteName(''); setRouteCode('');
      await loadRoutes();
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed.'); }
    finally { setBusy(false); }
  };

  // ---- Month closing ----
  const now = new Date();
  const [mcMonth, setMcMonth] = useState(String(now.getMonth() + 1));
  const [mcYear, setMcYear] = useState(String(now.getFullYear()));
  const [mcList, setMcList] = useState<any[]>([]);

  const loadMonthClosings = async () => {
    try {
      const res = await fetch('/api/admin/month-closing');
      const data = await res.json().catch(() => null);
      if (data?.success) setMcList(data.monthClosings || []);
    } catch { /* best effort */ }
  };

  useEffect(() => { if (tool === 'monthclose') void loadMonthClosings(); }, [tool]);

  const handleMonthClose = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    const m = parseInt(mcMonth, 10); const y = parseInt(mcYear, 10);
    if (!Number.isFinite(m) || m < 1 || m > 12) { setError('Month must be 1–12.'); return; }
    if (!Number.isFinite(y) || y < 2000 || y > 2100) { setError('Year must be 2000–2100.'); return; }
    const farmerId = customers[0]?.farmerId || 'F001';
    setBusy(true);
    try {
      const data = await postJson('/api/admin/month-closing', { farmerId, month: m, year: y });
      setSuccess(data.message || `Month ${m}/${y} finalized.`);
      await loadMonthClosings();
    } catch (e) { setError(e instanceof Error ? e.message : 'Finalize failed.'); }
    finally { setBusy(false); }
  };

  // ---- Operational closures ----
  const [clDate, setClDate] = useState('');
  const [clReason, setClReason] = useState('');
  const [clShift, setClShift] = useState('MORNING');

  const handleClosure = async (e: React.FormEvent) => {
    e.preventDefault(); reset();
    if (!clDate) { setError('Closure date is required.'); return; }
    if (!clReason.trim()) { setError('A reason is required for audit.'); return; }
    setBusy(true);
    try {
      const data = await postJson('/api/admin/operational-closures', { date: clDate, reason: clReason.trim(), shift: clShift });
      setSuccess(data.message || 'Closure applied.');
      setClDate(''); setClReason('');
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Closure failed.'); }
    finally { setBusy(false); }
  };

  const icons: Record<ToolId, React.ReactNode> = {
    import: <Upload className="w-4 h-4" />,
    merge: <GitMerge className="w-4 h-4" />,
    transfer: <ArrowRightLeft className="w-4 h-4" />,
    adjust: <Receipt className="w-4 h-4" />,
    pricehist: <History className="w-4 h-4" />,
    subver: <Layers className="w-4 h-4" />,
    routes: <RouteIcon className="w-4 h-4" />,
    monthclose: <CalendarCheck className="w-4 h-4" />,
    closures: <Power className="w-4 h-4" />,
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs focus:outline-none focus:border-emerald-500';
  const labelCls = 'block font-bold text-slate-700 mb-1 text-xs';
  const btnPrimary = 'px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition';

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Operations Console</h2>
        <p className="text-xs text-slate-500 mt-0.5">Bulk import, merges, transfers, adjustments, pricing history, routes, closings — every backend API now has a working form.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTool(t.id); reset(); }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer ${tool === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-700'}`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">{icons[t.id]}<span>{t.label}</span></div>
              <div className={`text-[11px] mt-0.5 ${tool === t.id ? 'text-slate-300' : 'text-slate-500'}`}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <Banner error={error} success={success} />

        {tool === 'import' && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Paste CSV rows — Name, Phone, Address (one per line)</label>
              <textarea rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} className={`${inputCls} font-mono`} placeholder="Ramesh Chandra, +91 98234 56789, Flat 101" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleDryRun} disabled={busy} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-50">Preview (Dry Run)</button>
              <button onClick={handleImport} disabled={busy} className={btnPrimary}>{busy ? 'Working…' : 'Import Customers'}</button>
            </div>
            {preview && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>Total: {preview.totalRows} • Valid: {preview.validCount} • Errors: {preview.errorCount}</div>
                {(preview.errors || []).map((er: any, i: number) => (
                  <div key={i} className="text-rose-700">Row {er.row} ({er.phone}): {er.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'merge' && (
          <form onSubmit={handleMerge} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Primary (keep) customer</label>
                <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Duplicate (merge away) customer</label>
                <select value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Merging…' : 'Merge Customers'}</button>
          </form>
        )}

        {tool === 'transfer' && (
          <div className="space-y-4">
            <form onSubmit={handleTransferInit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Customer to transfer</label>
                  <select value={transferCust} onChange={(e) => setTransferCust(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Destination farmer ID</label>
                  <input value={toFarmer} onChange={(e) => setToFarmer(e.target.value)} placeholder="e.g. farmer UUID or F002" className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Customer relocated" className={inputCls} />
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Initiating…' : 'Initiate Transfer'}</button>
            </form>
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Transfer request ID</label>
                  <input value={transferId} onChange={(e) => setTransferId(e.target.value)} placeholder="tr_… / uuid" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Action</label>
                  <select value={transferAction} onChange={(e) => setTransferAction(e.target.value as any)} className={inputCls}>
                    <option value="APPROVE">APPROVE</option>
                    <option value="ACCEPT">ACCEPT (complete move)</option>
                    <option value="REJECT">REJECT</option>
                  </select>
                </div>
              </div>
              <button onClick={handleTransferStep} disabled={busy} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50">Apply {transferAction}</button>
            </div>
          </div>
        )}

        {tool === 'adjust' && (
          <form onSubmit={handleAdjust} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Invoice</label>
                <select value={adjInvoice} onChange={(e) => setAdjInvoice(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — {i.customerName} (₹{i.outstandingAmount})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select value={adjType} onChange={(e) => setAdjType(e.target.value as any)} className={inputCls}>
                  <option value="CREDIT">CREDIT (reduce bill)</option>
                  <option value="DEBIT">DEBIT (increase bill)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount (₹)</label>
                <input type="number" step="1" min="1" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className={`${inputCls} font-mono`} placeholder="50" />
              </div>
              <div>
                <label className={labelCls}>Reason (audit)</label>
                <input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className={inputCls} placeholder="Promotion discount" />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Applying…' : 'Apply Adjustment'}</button>
          </form>
        )}

        {tool === 'pricehist' && (
          <div className="space-y-3">
            <form onSubmit={handlePriceHist} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Product</label>
                  <select value={phProduct} onChange={(e) => setPhProduct(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>New price (₹/unit)</label>
                  <input type="number" step="0.5" min="0" value={phPrice} onChange={(e) => setPhPrice(e.target.value)} className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Effective from</label>
                  <input type="date" value={phFrom} onChange={(e) => setPhFrom(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Effective to (optional)</label>
                  <input type="date" value={phTo} onChange={(e) => setPhTo(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save Price Entry'}</button>
            </form>
            {phList.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {phList.map((h: any) => (
                  <div key={h.id} className="px-3 py-2 flex justify-between bg-white">
                    <span className="font-mono">₹{h.pricePerUnit} from {String(h.effectiveFrom).slice(0, 10)}</span>
                    <span className="text-slate-500">{h.productName || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'subver' && (
          <div className="space-y-3">
            <form onSubmit={handleSubVer} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Customer</label>
                  <select value={svCustomer} onChange={(e) => setSvCustomer(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Product</label>
                  <select value={svProduct} onChange={(e) => setSvProduct(e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Quantity (L)</label>
                  <input type="number" step="0.5" min="0.5" max="50" value={svQty} onChange={(e) => setSvQty(e.target.value)} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Effective from</label>
                  <input type="date" value={svFrom} onChange={(e) => setSvFrom(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Record Version'}</button>
            </form>
            {svList.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {svList.map((v: any) => (
                  <div key={v.id} className="px-3 py-2 flex justify-between bg-white">
                    <span className="font-mono">{v.quantity} L — {v.productName || v.productId}</span>
                    <span className="text-slate-500">{String(v.effectiveFrom).slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'routes' && (
          <div className="space-y-3">
            <form onSubmit={handleRoute} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Route name</label>
                  <input value={routeName} onChange={(e) => setRouteName(e.target.value)} className={inputCls} placeholder="Morning North Express" />
                </div>
                <div>
                  <label className={labelCls}>Code</label>
                  <input value={routeCode} onChange={(e) => setRouteCode(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder="RTE-NORTH" />
                </div>
                <div>
                  <label className={labelCls}>Shift</label>
                  <select value={routeShift} onChange={(e) => setRouteShift(e.target.value)} className={inputCls}>
                    <option value="MORNING">MORNING</option>
                    <option value="EVENING">EVENING</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Creating…' : 'Create Route'}</button>
                <button type="button" onClick={() => void loadRoutes()} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
              </div>
            </form>
            {routeList.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {routeList.map((r: any) => (
                  <div key={r.id} className="px-3 py-2 flex justify-between bg-white">
                    <span className="font-bold">{r.name} <span className="font-mono text-slate-500">({r.code})</span></span>
                    <span className="text-slate-500">{r.shift} • {(r.stops || []).length} stops</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'monthclose' && (
          <div className="space-y-3">
            <form onSubmit={handleMonthClose} className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Month (1–12)</label>
                <input type="number" min="1" max="12" value={mcMonth} onChange={(e) => setMcMonth(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>Year</label>
                <input type="number" min="2000" max="2100" value={mcYear} onChange={(e) => setMcYear(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Finalizing…' : 'Finalize Month'}</button>
            </form>
            {mcList.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {mcList.slice(0, 10).map((m: any) => (
                  <div key={m.id} className="px-3 py-2 flex justify-between bg-white">
                    <span className="font-mono font-bold">{m.month}/{m.year}</span>
                    <span className="text-emerald-700 font-bold">{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tool === 'closures' && (
          <form onSubmit={handleClosure} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Closure date</label>
                <input type="date" value={clDate} onChange={(e) => setClDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Shift</label>
                <select value={clShift} onChange={(e) => setClShift(e.target.value)} className={inputCls}>
                  <option value="MORNING">MORNING</option>
                  <option value="EVENING">EVENING</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <input value={clReason} onChange={(e) => setClReason(e.target.value)} className={inputCls} placeholder="Dairy maintenance holiday" />
              </div>
            </div>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Applying…' : 'Apply Operational Closure'}</button>
            <p className="text-[11px] text-slate-500">All EXPECTED deliveries on that date are marked SKIPPED with closure notes.</p>
          </form>
        )}
      </div>
    </div>
  );
}
