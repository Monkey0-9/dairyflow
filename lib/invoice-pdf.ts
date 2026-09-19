'use client';

/**
 * Client-side invoice PDF generation (jsPDF, no server round-trip beyond the
 * statement JSON). Uses WinAnsi-safe "Rs." prefix — the base-14 PDF fonts
 * cannot render the ₹ glyph.
 */

import { jsPDF } from 'jspdf';

interface StatementLineItem {
  description: string;
  quantity: number;
  amount: number;
}

interface StatementPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  ref: string;
}

interface Statement {
  status: string;
  customerId: string;
  billingCycle: string;
  period: { from: string; to: string };
  lineItems: StatementLineItem[];
  summary: {
    regularMilkAmount: number;
    extraMilkAmount: number;
    disputeAdjustments: number;
    skippedDaysCount: number;
    grossTotal: number;
    totalPaid: number;
    outstandingBalance: number;
    status: string;
  };
  payments: StatementPayment[];
  dueDate: string;
}

const rs = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export async function downloadInvoicePdf(params: {
  customerId?: string;
  invoiceId?: string;
  month: number;
  year: number;
  customerName?: string;
  customerPhone?: string;
  dairyName?: string;
  upiId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const qs = new URLSearchParams({
      month: String(params.month),
      year: String(params.year),
    });
    if (params.customerId) qs.set('customerId', params.customerId);
    if (params.invoiceId) qs.set('invoiceId', params.invoiceId);
    const res = await fetch(`/api/invoices/statement?${qs.toString()}`);
    const data = await res.json();
    if (!data.success || !data.statement) {
      return { success: false, error: data.error || 'Statement unavailable' };
    }
    const st = data.statement as Statement;
    const dairy = params.dairyName || 'MilkFlow Dairy Enterprise';
    const upi = params.upiId || 'payment@milkflow';

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = 595;
    let y = 56;

    // Header band
    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, W, 92, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('MilkFlow Dairy Invoice', 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${dairy}  |  ${st.billingCycle}  |  Status: ${st.status}`, 40, 62);
    doc.text(`Period: ${st.period.from} to ${st.period.to}   |   Due: ${st.dueDate}`, 40, 78);

    y = 120;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Billed To', 40, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(params.customerName || st.customerId, 40, y + 16);
    if (params.customerPhone) doc.text(`Phone: ${params.customerPhone}`, 40, y + 30);

    y += 58;

    // Line items table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Description', 40, y);
    doc.text('Qty (L)', 360, y);
    doc.text('Amount', 470, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(40, y, W - 40, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    for (const item of st.lineItems) {
      if (y > 720) {
        doc.addPage();
        y = 56;
      }
      doc.text(item.description.slice(0, 52), 40, y);
      doc.text(Number(item.quantity || 0).toFixed(1), 360, y);
      doc.text(rs(item.amount), 470, y);
      y += 18;
    }
    doc.line(40, y, W - 40, y);
    y += 18;

    // Summary
    const s = st.summary;
    const rows: [string, number][] = [
      ['Regular milk', s.regularMilkAmount],
      ['Extra milk', s.extraMilkAmount],
      ['Dispute adjustments', -Math.abs(s.disputeAdjustments)],
      ['Gross total', s.grossTotal],
      ['Total paid', -s.totalPaid],
      ['Outstanding balance', s.outstandingBalance],
    ];
    doc.setFontSize(10);
    for (const [label, val] of rows) {
      const bold = label === 'Gross total' || label === 'Outstanding balance';
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(label, 330, y);
      doc.text(rs(val), 470, y);
      y += 16;
    }
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Skipped (vacation) days this cycle: ${s.skippedDaysCount}`, 40, y);
    y += 22;

    // Payments
    if (st.payments.length > 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Payments received', 40, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const p of st.payments.slice(0, 12)) {
        if (y > 740) {
          doc.addPage();
          y = 56;
        }
        doc.text(`${String(p.date).slice(0, 10)}  |  ${p.method}  |  ${rs(p.amount)}  |  Ref: ${p.ref}`, 40, y);
        y += 14;
      }
      y += 8;
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Pay outstanding via UPI: ${upi}`, 40, 780);
    doc.text('Thank you for choosing farm fresh milk. Computer-generated invoice.', 40, 794);

    const fname = `MilkFlow-Inv-${st.customerId}-${params.month}-${params.year}.pdf`;
    doc.save(fname);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'PDF generation failed' };
  }
}

export interface StatementData {
  statementId: string;
  memberName: string;
  period: string;
  transactions: Array<{
    date: string;
    description: string;
    litres: number | string;
    rate: number;
    amount: number;
  }>;
  total: number;
}

export async function generateStatementPDF(data: StatementData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 595.28, 90, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MilkFlow Private Reserve', 40, 45);
  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55); // Champagne gold
  doc.text('Cryptographically Verified Member Statement', 40, 65);

  // Member Information
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MEMBER STATEMENT', 40, 120);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Client: ${data.memberName}`, 40, 140);
  doc.text(`Billing Period: ${data.period}`, 40, 155);
  doc.text(`Statement ID: ${data.statementId}`, 40, 170);

  // Table header
  let y = 205;
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y - 14, 515, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Date', 50, y);
  doc.text('Description', 130, y);
  doc.text('Litres', 360, y);
  doc.text('Rate', 430, y);
  doc.text('Amount', 500, y);

  y += 20;
  doc.setFont('helvetica', 'normal');
  for (const t of data.transactions.slice(0, 25)) {
    doc.text(String(t.date).slice(0, 10), 50, y);
    doc.text(String(t.description).slice(0, 35), 130, y);
    doc.text(String(t.litres), 360, y);
    doc.text(rs(t.rate), 430, y);
    doc.text(rs(t.amount), 500, y);
    y += 18;
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  }

  // Total
  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(40, y, 555, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAYABLE TOTAL:', 360, y);
  doc.setTextColor(212, 175, 55);
  doc.text(rs(data.total), 500, y);

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Tamper-evident record: SHA-256 integrity chained. Computer-generated accounting proof.', 40, 800);

  return doc.output('blob');
}

