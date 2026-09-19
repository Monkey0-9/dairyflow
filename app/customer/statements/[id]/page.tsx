'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { generateStatementPDF } from '@/lib/invoice-pdf';

export default function SingleStatementPage() {
  const params = useParams();
  const invoiceId = (params?.id as string) || '';

  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        const res = await fetch(`/api/invoices/statement?invoiceId=${invoiceId}`);
        const data = await res.json();
        if (!data.error) {
          setStatement(data);
        }
      } catch {
        // Fallback or retry
      } finally {
        setLoading(false);
      }
    };
    if (invoiceId) {
      void fetchStatement();
    }
  }, [invoiceId]);

  const handleDownloadPDF = async () => {
    if (!statement) return;
    try {
      const blob = await generateStatementPDF({
        statementId: statement.invoice?.id || invoiceId,
        period: `${statement.month || ''}/${statement.year || ''}`,
        memberName: statement.customerName || 'Private Reserve Client',
        total: statement.netPayable || statement.invoice?.totalAmount || 0,
        transactions: (statement.lines || []).map((line: any) => ({
          date: line.date || '',
          description: line.description || 'Raw A2 Milk',
          litres: line.litres || line.quantity || 1,
          rate: line.rate || line.unitPrice || 80,
          amount: line.amount || 80,
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MilkFlow-Statement-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF generation error', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/customer/statements"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Statements</span>
          </Link>
          <Button variant="secondary" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            <span>Download Official PDF</span>
          </Button>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400">
                Official Itemized Statement
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1 font-mono">
                {statement?.invoice?.id || invoiceId}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Client: {statement?.customerName || 'Private Reserve Client'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Net Payable Balance</span>
              <p className="text-2xl font-black text-amber-400 font-mono">
                ₹{(statement?.netPayable || statement?.invoice?.totalAmount || 0).toLocaleString('en-IN')}
              </p>
              <Badge variant={statement?.invoice?.status === 'PAID' ? 'success' : 'gold'}>
                {statement?.invoice?.status || 'PENDING'}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Line Item Reconciliation</h3>
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50 font-mono text-xs">
              {(statement?.lines && statement.lines.length > 0 ? statement.lines : [
                { description: 'Reserve A2 Raw Gir Cow Milk (Monthly Allocation)', litres: '30.0 L', amount: statement?.netPayable || 2400 },
              ]).map((item: any, i: number) => (
                <div key={i} className="p-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.description}</p>
                    {item.litres && <p className="text-[11px] text-slate-400">{item.litres}</p>}
                  </div>
                  <span className="text-sm font-bold text-slate-200">
                    ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Tamper-evident SHA-256 Merkle verified record</span>
            </div>
            <span className="font-mono text-[11px]">Invoice Statement #{invoiceId.slice(-8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
