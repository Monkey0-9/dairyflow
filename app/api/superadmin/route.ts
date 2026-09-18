import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getPlatformKPIs, getPlatformTenants, getPlatformFarmers } from '@/lib/services/superadmin.service';
import { getAllCustomersPlatform } from '@/lib/services/customer.service';
import { verifyAuditChain } from '@/lib/services/audit.service';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  // Enforce SUPERADMIN / ADMIN role
  const auth = authenticateRequest(req, ['SUPERADMIN', 'ADMIN']);
  if ('errorResponse' in auth) {
    return auth.errorResponse;
  }

  try {
    const [kpis, tenants, farmers, customers, auditStatus] = await Promise.all([
      getPlatformKPIs(),
      getPlatformTenants(),
      getPlatformFarmers(),
      getAllCustomersPlatform(),
      verifyAuditChain('tenant_greenvalley'),
    ]);

    // Recent platform payments
    const payRes = await query(
      `SELECT p.id, p.tenant_id as "tenantId", p.amount::float as amount, p.method,
              p.transaction_ref as "transactionRef", p.status, p.paid_at as "paidAt",
              u.name as "customerName", t.name as "tenantName"
       FROM payments p
       JOIN customer_profiles c ON p.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       JOIN tenants t ON p.tenant_id = t.id
       ORDER BY p.paid_at DESC
       LIMIT 10`
    );

    // Platform activity
    const actRes = await query(
      `SELECT a.id, a.tenant_id as "tenantId", a.actor_role as "actorRole",
              a.action, a.description, a.created_at as "createdAt",
              t.name as "tenantName"
       FROM activity_events a
       JOIN tenants t ON a.tenant_id = t.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );

    return NextResponse.json({
      success: true,
      kpis,
      tenants,
      farmers,
      customers,
      auditStatus,
      recentPayments: payRes.rows,
      recentActivity: actRes.rows,
    });
  } catch (err: any) {
    console.error('[SuperAdmin API] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
