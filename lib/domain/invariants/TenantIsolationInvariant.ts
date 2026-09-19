import { query } from '@/lib/db';
import { InvariantResult } from './CustomerOwnershipInvariant';

/**
 * TenantIsolationInvariant:
 * Multi-layer cascade invariant ensuring all related entities (customer, deliveries, invoices, payments)
 * strictly share the exact same tenant ID with zero cross-tenant linkage.
 */
export async function assertTenantIsolationCascade(params: {
  tenantId: string;
  customerId?: string;
  invoiceId?: string;
  deliveryId?: string;
  paymentId?: string;
}): Promise<InvariantResult> {
  // 1. Verify Customer Tenant Isolation
  if (params.customerId) {
    const custRes = await query<{ tenantId: string }>(
      `SELECT tenant_id as "tenantId" FROM customer_profiles WHERE id = $1`,
      [params.customerId]
    );
    if (custRes.rows.length > 0 && custRes.rows[0].tenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_CUSTOMER_VIOLATION',
        message: `Customer ${params.customerId} has mismatched tenant ${custRes.rows[0].tenantId}.`,
      };
    }
  }

  // 2. Verify Delivery Tenant Isolation
  if (params.deliveryId) {
    const delRes = await query<{ tenantId: string }>(
      `SELECT tenant_id as "tenantId" FROM delivery_records WHERE id = $1`,
      [params.deliveryId]
    );
    if (delRes.rows.length > 0 && delRes.rows[0].tenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_DELIVERY_VIOLATION',
        message: `Delivery ${params.deliveryId} has mismatched tenant ${delRes.rows[0].tenantId}.`,
      };
    }
  }

  // 3. Verify Invoice Tenant Isolation
  if (params.invoiceId) {
    const invRes = await query<{ tenantId: string; customerId: string }>(
      `SELECT tenant_id as "tenantId", customer_id as "customerId" FROM invoices WHERE id = $1`,
      [params.invoiceId]
    );
    if (invRes.rows.length > 0) {
      if (invRes.rows[0].tenantId !== params.tenantId) {
        return {
          valid: false,
          code: 'CROSS_TENANT_INVOICE_VIOLATION',
          message: `Invoice ${params.invoiceId} has mismatched tenant ${invRes.rows[0].tenantId}.`,
        };
      }
      // Check customer linkage
      if (params.customerId && invRes.rows[0].customerId !== params.customerId) {
        return {
          valid: false,
          code: 'INVOICE_CUSTOMER_MISMATCH',
          message: `Invoice ${params.invoiceId} does not belong to customer ${params.customerId}.`,
        };
      }
    }
  }

  // 4. Verify Payment Tenant Isolation
  if (params.paymentId) {
    const payRes = await query<{ tenantId: string; invoiceId: string }>(
      `SELECT tenant_id as "tenantId", invoice_id as "invoiceId" FROM payments WHERE id = $1`,
      [params.paymentId]
    );
    if (payRes.rows.length > 0 && payRes.rows[0].tenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_PAYMENT_VIOLATION',
        message: `Payment ${params.paymentId} has mismatched tenant ${payRes.rows[0].tenantId}.`,
      };
    }
  }

  return { valid: true, code: 'OK', message: 'Tenant isolation invariant fully satisfied across all cascade layers.' };
}
