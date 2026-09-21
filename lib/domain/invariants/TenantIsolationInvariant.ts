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
  let currentCustomerId = params.customerId;
  let currentInvoiceId = params.invoiceId;

  // 1. Verify Payment Tenant Isolation (most specific)
  if (params.paymentId) {
    const payRes = await query<{ tenantId: string; invoiceId: string }>(
      `SELECT tenant_id as "tenantId", invoice_id as "invoiceId" FROM payments WHERE id = $1`,
      [params.paymentId]
    );

    if (payRes.rows.length === 0) {
      return {
        valid: false,
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment ${params.paymentId} not found.`,
      };
    }

    const paymentTenantId = payRes.rows[0].tenantId;
    const paymentInvoiceId = payRes.rows[0].invoiceId;

    if (paymentTenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_PAYMENT_VIOLATION',
        message: `Payment ${params.paymentId} has mismatched tenant ${paymentTenantId}.`,
      };
    }

    // If params.invoiceId was provided, ensure it matches the payment's invoiceId
    if (currentInvoiceId && currentInvoiceId !== paymentInvoiceId) {
      return {
        valid: false,
        code: 'PAYMENT_INVOICE_MISMATCH',
        message: `Payment ${params.paymentId} does not belong to invoice ${currentInvoiceId}.`,
      };
    }
    // Use the payment's invoiceId for subsequent checks if not already provided
    currentInvoiceId = paymentInvoiceId;
  }

  // 2. Verify Invoice Tenant Isolation (if present or derived)
  if (currentInvoiceId) {
    const invRes = await query<{ tenantId: string; customerId: string }>(
      `SELECT tenant_id as "tenantId", customer_id as "customerId" FROM invoices WHERE id = $1`,
      [currentInvoiceId]
    );

    if (invRes.rows.length === 0) {
      return {
        valid: false,
        code: 'INVOICE_NOT_FOUND',
        message: `Invoice ${currentInvoiceId} not found.`,
      };
    }

    const invoiceTenantId = invRes.rows[0].tenantId;
    const invoiceCustomerId = invRes.rows[0].customerId;

    if (invoiceTenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_INVOICE_VIOLATION',
        message: `Invoice ${currentInvoiceId} has mismatched tenant ${invoiceTenantId}.`,
      };
    }

    // If params.customerId was provided, ensure it matches the invoice's customerId
    if (currentCustomerId && currentCustomerId !== invoiceCustomerId) {
      return {
        valid: false,
        code: 'INVOICE_CUSTOMER_MISMATCH',
        message: `Invoice ${currentInvoiceId} does not belong to customer ${currentCustomerId}.`,
      };
    }
    // Use the invoice's customerId for subsequent checks if not already provided
    currentCustomerId = invoiceCustomerId;
  }

  // 3. Verify Customer Tenant Isolation (if present or derived)
  if (currentCustomerId) {
    const custRes = await query<{ tenantId: string }>(
      `SELECT tenant_id as "tenantId" FROM customer_profiles WHERE id = $1`,
      [currentCustomerId]
    );

    if (custRes.rows.length === 0) {
      return {
        valid: false,
        code: 'CUSTOMER_NOT_FOUND',
        message: `Customer ${currentCustomerId} not found.`,
      };
    }

    const customerTenantId = custRes.rows[0].tenantId;

    if (customerTenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_CUSTOMER_VIOLATION',
        message: `Customer ${currentCustomerId} has mismatched tenant ${customerTenantId}.`,
      };
    }
  }

  // 4. Verify Delivery Tenant Isolation (independent)
  if (params.deliveryId) {
    const delRes = await query<{ tenantId: string }>(
      `SELECT tenant_id as "tenantId" FROM delivery_records WHERE id = $1`,
      [params.deliveryId]
    );

    if (delRes.rows.length === 0) {
      return {
        valid: false,
        code: 'DELIVERY_NOT_FOUND',
        message: `Delivery ${params.deliveryId} not found.`,
      };
    }

    const deliveryTenantId = delRes.rows[0].tenantId;

    if (deliveryTenantId !== params.tenantId) {
      return {
        valid: false,
        code: 'CROSS_TENANT_DELIVERY_VIOLATION',
        message: `Delivery ${params.deliveryId} has mismatched tenant ${deliveryTenantId}.`,
      };
    }
  }

  return { valid: true, code: 'OK', message: 'Tenant isolation invariant fully satisfied across all cascade layers.' };
}
