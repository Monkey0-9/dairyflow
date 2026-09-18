import { describe, it, expect } from 'vitest';
import {
  generateOpaqueToken,
  lookupQrToken,
  confirmDeliveryViaQrScan,
  revokeQrToken,
} from '@/lib/services/qr.service';
import { getStore } from '@/lib/store';

describe('Stage 21: QR System Security & Token Hardening', () => {
  it('generates opaque cryptographic tokens with zero customer PII in string', () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^MF_QR_[a-f0-9]{48}$/);
    expect(token).not.toContain('suresh');
    expect(token).not.toContain('phone');
    expect(token).not.toContain('address');
    expect(token).not.toContain('@');
  });

  it('successfully resolves an active valid QR token to customer delivery profile', async () => {
    const store = getStore();
    const cust = store.customers[0];
    const lookup = await lookupQrToken(cust.qrToken);

    expect(lookup.success).toBe(true);
    expect(lookup.data?.customerId).toBe(cust.id);
    expect(lookup.data?.customerName).toBe(cust.name);
    expect(lookup.data?.status).toBe('ACTIVE');
  });

  it('rejects malformed or non-existent QR tokens', async () => {
    const malformed = await lookupQrToken('INVALID_MALFORMED_TOKEN_XYZ_999');
    expect(malformed.success).toBe(false);
    expect(malformed.error).toContain('Invalid or unrecognized QR token');
  });

  it('blocks scan when scanning farmer does not own the customer (wrong farmer/tenant boundary)', async () => {
    const store = getStore();
    const cust = store.customers[0];

    const rogueFarmerId = 'farmer_unauthorized_attacker';
    const scanResult = await confirmDeliveryViaQrScan({
      token: cust.qrToken,
      farmerId: rogueFarmerId,
      tenantId: 'tenant_other',
      date: '2026-09-18',
      quantity: 1.0,
    });

    expect(scanResult.success).toBe(false);
    expect(scanResult.error).toContain('different dairy farmer');
  });

  it('blocks revoked QR token from lookup or delivery', async () => {
    const store = getStore();
    const cust = store.customers[1];
    const originalToken = cust.qrToken;

    // Revoke token
    await revokeQrToken({
      customerId: cust.id,
      tenantId: cust.tenantId,
      actorId: 'user_farmer',
      actorRole: 'FARMER',
    });

    // Lookup on revoked token fails
    const lookup = await lookupQrToken(originalToken);
    expect(lookup.success).toBe(false);
  });
});
