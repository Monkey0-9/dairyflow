import { query, transaction } from '../db';
import crypto from 'crypto';
import { appendAuditLog } from './audit.service';
import { updateDeliveryStatus } from './delivery.service';
import { getStore } from '../store';

function isUnitTest(): boolean {
  return process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';
}

export interface QrIdentityRecord {
  id: string;
  customerId: string;
  token: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  lastScannedAt?: string | null;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  farmerId?: string;
  milkType?: string;
  dailyQuantity?: number;
}

/**
 * Generate a cryptographically secure opaque QR token.
 */
export function generateOpaqueToken(): string {
  return `MF_QR_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Look up a customer and subscription via their active QR token.
 */
export async function lookupQrToken(token: string): Promise<{
  success: boolean;
  data?: QrIdentityRecord;
  error?: string;
}> {
  if (isUnitTest()) {
    const store = getStore();
    const customer = store.customers.find((c) => c.qrToken === token);
    if (!customer) {
      return { success: false, error: 'Invalid or unrecognized QR token' };
    }
    const sub = store.subscriptions.find((s) => s.customerId === customer.id);
    return {
      success: true,
      data: {
        id: `qr_${customer.id}`,
        customerId: customer.id,
        token,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        customerName: customer.name,
        customerPhone: customer.phone,
        deliveryAddress: customer.address,
        farmerId: customer.farmerId,
        dailyQuantity: sub?.defaultQuantity ?? 1.0,
        milkType: sub?.productId === 'p_buffalo' ? 'Buffalo' : 'Cow',
      },
    };
  }

  try {
    const res = await query<{
      id: string;
      customer_id: string;
      token: string;
      status: string;
      last_scanned_at: string | Date | null;
      created_at: string | Date;
      customer_name: string;
      customer_phone?: string;
      delivery_address: string;
      farmer_id: string;
      milk_type: string;
      daily_quantity: number;
    }>(
      `SELECT q.id, q.customer_id, q.token, q.status, q.last_scanned_at, q.created_at,
              u.name as customer_name, u.phone as customer_phone,
              c.delivery_address, c.farmer_id, c.milk_type, c.daily_quantity::float
       FROM qr_identities q
       JOIN customer_profiles c ON q.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE q.token = $1`,
      [token]
    );

    if (res.rows.length === 0) {
      return { success: false, error: 'Invalid or unrecognized QR token' };
    }

    const row = res.rows[0];
    if (row.status !== 'ACTIVE') {
      return { success: false, error: `QR token is ${row.status.toLowerCase()}` };
    }

    return {
      success: true,
      data: {
        id: row.id,
        customerId: row.customer_id,
        token: row.token,
        status: row.status as 'ACTIVE' | 'REVOKED' | 'EXPIRED',
        lastScannedAt: row.last_scanned_at ? new Date(row.last_scanned_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        deliveryAddress: row.delivery_address,
        farmerId: row.farmer_id,
        milkType: row.milk_type,
        dailyQuantity: row.daily_quantity,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error looking up QR token';
    console.error('[QrService] lookupQrToken error:', message);
    return { success: false, error: message };
  }
}

/**
 * Confirm daily milk delivery via QR code scan with anti-duplicate protection.
 */
export async function confirmDeliveryViaQrScan(params: {
  token: string;
  farmerId: string;
  tenantId: string;
  date: string;
  quantity?: number;
  bottlesReturned?: number;
}): Promise<{
  success: boolean;
  customerId?: string;
  deliveredQuantity?: number;
  error?: string;
}> {
  const lookup = await lookupQrToken(params.token);
  if (!lookup.success || !lookup.data) {
    return { success: false, error: lookup.error || 'Invalid QR token' };
  }

  const identity = lookup.data;

  // Authorization check: Verify customer belongs to the scanning farmer
  if (identity.farmerId !== params.farmerId) {
    return {
      success: false,
      error: 'Unauthorized: This customer belongs to a different dairy farmer',
    };
  }

  // Duplicate scan cooldown check (anti-double scan within 30 seconds)
  if (identity.lastScannedAt) {
    const lastScan = new Date(identity.lastScannedAt).getTime();
    const now = Date.now();
    if (now - lastScan < 30000) {
      return {
        success: false,
        error: 'Duplicate scan prevented: Delivery already registered moments ago',
      };
    }
  }

  const finalQty = params.quantity ?? identity.dailyQuantity ?? 1.0;

  if (isUnitTest()) {
    const store = getStore();
    const dayLedger = store.getOrGenerateDailyLedger(params.date);
    const rec = dayLedger.find((r) => r.customerId === identity.customerId);
    if (rec) {
      store.updateDeliveryRecord(
        rec.id,
        {
          status: 'DELIVERED',
          deliveredQuantity: finalQty,
          bottlesReturned: params.bottlesReturned ?? 0,
        },
        { userId: params.farmerId, name: 'Farmer', role: 'FARMER' }
      );
    }
    return { success: true, customerId: identity.customerId, deliveredQuantity: finalQty };
  }

  return transaction(async (client) => {
    // 1. Mark delivery as DELIVERED
    const deliveryRes = await updateDeliveryStatus({
      customerId: identity.customerId,
      farmerId: params.farmerId,
      date: params.date,
      status: 'DELIVERED',
      deliveredQuantity: finalQty,
      notes: 'Delivered via verified QR scan',
      bottlesReturned: params.bottlesReturned ?? 0,
    });

    if (!deliveryRes.success) {
      return { success: false, error: deliveryRes.error || 'Failed to update delivery' };
    }

    // 2. Update last_scanned_at
    await client.query(
      `UPDATE qr_identities SET last_scanned_at = NOW() WHERE token = $1`,
      [params.token]
    );

    // 3. Append to cryptographic audit blockchain
    await appendAuditLog({
      tenantId: params.tenantId,
      actorId: params.farmerId,
      actorRole: 'FARMER',
      entityType: 'DELIVERY',
      entityId: `${identity.customerId}_${params.date}`,
      action: 'QR_DELIVERY_CONFIRMED',
      beforeState: { status: 'EXPECTED' },
      afterState: { status: 'DELIVERED', quantity: finalQty, bottlesReturned: params.bottlesReturned ?? 0 },
    });

    return { success: true, customerId: identity.customerId, deliveredQuantity: finalQty };
  });
}

/**
 * Regenerate an active QR token for a customer.
 */
export async function regenerateQrToken(params: {
  customerId: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
}): Promise<{ success: boolean; newToken?: string; error?: string }> {
  const newToken = generateOpaqueToken();

  if (isUnitTest()) {
    const store = getStore();
    const cust = store.customers.find((c) => c.id === params.customerId);
    if (cust) cust.qrToken = newToken;
    return { success: true, newToken };
  }

  try {
    const newId = `QR_${params.customerId}_${Date.now()}`;
    await query(
      `INSERT INTO qr_identities (id, customer_id, token, status, created_at)
       VALUES ($1, $2, $3, 'ACTIVE', NOW())
       ON CONFLICT (customer_id)
       DO UPDATE SET token = EXCLUDED.token, status = 'ACTIVE', created_at = NOW()`,
      [newId, params.customerId, newToken]
    );

    await appendAuditLog({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: 'QR_IDENTITY',
      entityId: params.customerId,
      action: 'QR_TOKEN_REGENERATED',
      afterState: { token: newToken, status: 'ACTIVE' },
    });

    return { success: true, newToken };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to regenerate QR token';
    console.error('[QrService] regenerateQrToken error:', message);
    return { success: false, error: message };
  }
}

/**
 * Revoke an active QR token for a customer.
 */
export async function revokeQrToken(params: {
  customerId: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isUnitTest()) {
    const store = getStore();
    const cust = store.customers.find((c) => c.id === params.customerId);
    if (cust) cust.qrToken = '';
    return { success: true };
  }

  try {
    await query(
      `UPDATE qr_identities SET status = 'REVOKED' WHERE customer_id = $1`,
      [params.customerId]
    );

    await appendAuditLog({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: 'QR_IDENTITY',
      entityId: params.customerId,
      action: 'QR_TOKEN_REVOKED',
      afterState: { status: 'REVOKED' },
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to revoke QR token';
    console.error('[QrService] revokeQrToken error:', message);
    return { success: false, error: message };
  }
}
