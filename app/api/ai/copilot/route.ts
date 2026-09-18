import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStore } from '@/lib/store';
import { getInvoices } from '@/lib/services/billing.service';
import { getLedgerRange } from '@/lib/services/delivery.service';
import { buildReminderMessage, buildWhatsAppLink, ReminderLang } from '@/lib/reminders';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

/**
 * POST /api/ai/copilot
 * Natural-language dairy analytics over live ledger / invoices / inventory.
 * Body: { query: string, lang?: 'en'|'hi'|'mr', customerId?: string, amount?: number, phone?: string, customerName?: string }
 * - Analytical questions return computed answers from DB (fallback: store).
 * - { mode: 'reminder' } returns a localized WhatsApp reminder + wa.me link.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const q: string = String(body.query || '');
    const lang: ReminderLang = body.lang || 'en';

    // --- Reminder mode ---
    if (body.mode === 'reminder' || /remind|whatsapp|sms/i.test(q) && body.customerId) {
      const store = getStore();
      const cust = store.customers.find((c) => c.id === body.customerId);
      const inv = body.invoiceId ? store.invoices.find((i) => i.id === body.invoiceId) : store.invoices.find((i) => i.customerId === body.customerId);
      const customerName = body.customerName || cust?.name || 'Customer';
      const amount = body.amount ?? inv?.outstandingAmount ?? 0;
      const phone = body.phone || cust?.phone || '';
      const message = buildReminderMessage({ customerName, amount, lang, payLink: body.payLink });
      return NextResponse.json({
        success: true,
        type: 'reminder',
        message,
        whatsappUrl: phone ? buildWhatsAppLink(phone, message) : null,
        lang,
      });
    }

    const lower = q.toLowerCase();
    const store = getStore();
    const farmerId = session?.farmerId || store.farmer.id;

    // --- Tomorrow's milk need (Buffalo / Cow / A2 / total) ---
    if (/tomorrow|need|procure|morning|buffalo|cow|a2/.test(lower) && /milk|need|procure|much|tomorrow|morning/.test(lower)) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);
      let milkType: string | null = null;
      if (/buffalo/.test(lower)) milkType = 'Buffalo';
      else if (/\ba2\b/.test(lower)) milkType = 'A2';
      else if (/cow/.test(lower)) milkType = 'Cow';

      let total = 0;
      const breakdown: Record<string, number> = {};
      if (!isUnitTest()) {
        try {
          const rows = await getLedgerRange({ farmerId, fromDate: dateStr, toDate: dateStr });
          for (const r of rows) {
            const key = r.productName || 'Cow';
            breakdown[key] = (breakdown[key] || 0) + r.scheduledQuantity;
            total += r.scheduledQuantity;
          }
        } catch { /* fallback below */ }
      }
      if (total === 0) {
        // Store fallback: sum active subscription quantities
        const subs = store.subscriptions.filter((s) => s.active);
        for (const s of subs) {
          const prod = store.products.find((p) => p.id === s.productId);
          const key = prod?.name || s.productName || 'Cow';
          breakdown[key] = (breakdown[key] || 0) + s.defaultQuantity;
          total += s.defaultQuantity;
        }
        if (total === 0) {
          const qtyByCustomer = new Map(store.subscriptions.map((s) => [s.customerId, s.defaultQuantity]));
          for (const c of store.customers.filter((c) => c.active)) {
            const q = qtyByCustomer.get(c.id) ?? 1.0;
            breakdown['Cow'] = (breakdown['Cow'] || 0) + q;
            total += q;
          }
        }
      }
      const target = milkType ? (breakdown[milkType] ?? 0) : total;
      const safety = Math.round(target * 1.1 * 10) / 10;
      return NextResponse.json({
        success: true,
        type: 'procurement',
        answer: milkType
          ? `You need ~${target.toFixed(1)} L of ${milkType} milk for tomorrow morning (safety stock: ${safety.toFixed(1)} L).`
          : `You need ~${total.toFixed(1)} L total for tomorrow morning (safety stock: ${Math.round(total * 1.1 * 10) / 10} L). Breakdown: ${Object.entries(breakdown).map(([k, v]) => `${k} ${v.toFixed(1)} L`).join(', ') || 'n/a'}.`,
        breakdown,
        total,
        date: dateStr,
      });
    }

    // --- Overdue / unpaid bills ---
    if (/unpaid|overdue|due|pending.*bill|bill.*pending|defaulter/.test(lower)) {
      const daysMatch = lower.match(/(\d+)\s*days?/);
      const daysThreshold = daysMatch ? parseInt(daysMatch[1], 10) : 0;
      const overdue: { customerName: string; amount: number; month: number; year: number; phone?: string; customerId: string }[] = [];
      if (!isUnitTest()) {
        try {
          const invoices = await getInvoices({ farmerId });
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - daysThreshold);
          for (const inv of invoices) {
            if (inv.outstandingAmount > 0 && inv.status !== 'PAID') {
              const due = new Date(inv.dueDate);
              if (daysThreshold === 0 || due <= cutoff) {
                overdue.push({ customerName: inv.customerName || inv.customerId, amount: inv.outstandingAmount, month: inv.month, year: inv.year, phone: inv.customerPhone, customerId: inv.customerId });
              }
            }
          }
        } catch { /* fallback */ }
      }
      if (overdue.length === 0) {
        for (const inv of store.invoices) {
          if (inv.outstandingAmount > 0 && inv.status !== 'PAID') {
            const cust = store.customers.find((c) => c.id === inv.customerId);
            overdue.push({ customerName: cust?.name || inv.customerId, amount: inv.outstandingAmount, month: inv.month, year: inv.year, phone: cust?.phone, customerId: inv.customerId });
          }
        }
      }
      const reminders = overdue.slice(0, 10).map((o) => ({
        ...o,
        message: buildReminderMessage({ customerName: o.customerName, amount: o.amount, lang }),
        whatsappUrl: o.phone ? buildWhatsAppLink(o.phone, buildReminderMessage({ customerName: o.customerName, amount: o.amount, lang })) : null,
      }));
      return NextResponse.json({
        success: true,
        type: 'overdue',
        answer: overdue.length === 0
          ? 'No unpaid bills found. All customers are settled.'
          : `${overdue.length} customer(s) have unpaid bills${daysThreshold ? ` older than ${daysThreshold} days` : ''}: ${overdue.map((o) => `${o.customerName} (₹${o.amount})`).join(', ')}.`,
        customers: reminders,
      });
    }

    // --- Chronic skippers ---
    if (/skip|skipped|absent|vacation/.test(lower)) {
      const nMatch = lower.match(/(\d+)/);
      const threshold = nMatch ? parseInt(nMatch[1], 10) : 5;
      const month = new Date().toISOString().slice(0, 7);
      const counts: Record<string, number> = {};
      if (!isUnitTest()) {
        try {
          const rows = await getLedgerRange({ farmerId, fromDate: `${month}-01`, toDate: `${month}-31` });
          for (const r of rows) {
            if (r.status === 'SKIPPED') counts[r.customerId] = (counts[r.customerId] || 0) + 1;
          }
        } catch { /* fallback */ }
      }
      if (Object.keys(counts).length === 0) {
        for (const r of store.deliveryRecords.values()) {
          if (r.status === 'SKIPPED' && r.date.startsWith(month)) counts[r.customerId] = (counts[r.customerId] || 0) + 1;
        }
      }
      const chronic = Object.entries(counts)
        .filter(([, n]) => n >= threshold)
        .map(([customerId, skips]) => {
          const cust = store.customers.find((c) => c.id === customerId);
          return { customerId, customerName: cust?.name || customerId, skips };
        });
      // DB customer names when store lacks them
      if (chronic.length > 0 && chronic[0].customerName === chronic[0].customerId && !isUnitTest()) {
        try {
          const res = await query(`SELECT c.id, u.name FROM customer_profiles c JOIN users u ON c.user_id = u.id WHERE c.farmer_id = $1`, [farmerId]);
          const nameMap = new Map<string, string>(res.rows.map((r) => [(r as { id: string; name: string }).id, (r as { id: string; name: string }).name]));
          for (const c of chronic) c.customerName = nameMap.get(c.customerId) || c.customerId;
        } catch { /* keep ids */ }
      }
      return NextResponse.json({
        success: true,
        type: 'skippers',
        answer: chronic.length === 0
          ? `No customers skipped ${threshold} or more deliveries this month.`
          : `Customers with ${threshold}+ skips this month: ${chronic.map((c) => `${c.customerName} (${c.skips})`).join(', ')}.`,
        customers: chronic,
      });
    }

    // --- Fallback help ---
    return NextResponse.json({
      success: true,
      type: 'help',
      answer: 'Try: "How much Buffalo milk do I need for tomorrow morning?", "Which customers have unpaid bills older than 15 days?", or "Show customers who skipped more than 5 deliveries this month."',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Copilot failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
