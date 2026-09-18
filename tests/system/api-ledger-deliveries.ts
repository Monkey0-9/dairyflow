import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getLedgerHandler, PATCH as patchLedgerHandler } from '@/app/api/ledger/route';
import { resetTestStore } from '../setup';

describe('System Testing: Ledger & Delivery API Endpoints', () => {
  beforeEach(() => {
    resetTestStore();
  });

  describe('GET /api/ledger', () => {
    it('should return daily ledger records and summary stats for a valid date', async () => {
      const req = new NextRequest('http://localhost:3000/api/ledger?date=2026-09-17');
      const res = await getLedgerHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.date).toBe('2026-09-17');
      expect(Array.isArray(data.records)).toBe(true);
      expect(data.records.length).toBeGreaterThan(0);

      // Verify computed stats
      expect(data.stats).toBeDefined();
      expect(data.stats.customerCount).toBe(data.records.length);
      expect(data.stats.totalScheduled).toBeGreaterThan(0);
      expect(typeof data.stats.totalDelivered).toBe('number');
      expect(typeof data.stats.pendingLitres).toBe('number');
    });

    it('should default to 2026-09-16 when date query parameter is omitted', async () => {
      const req = new NextRequest('http://localhost:3000/api/ledger');
      const res = await getLedgerHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.date).toBe('2026-09-16');
    });
  });

  describe('PATCH /api/ledger', () => {
    it('should update delivery record quantity, status, and bottles returned', async () => {
      // First get a record from ledger
      const getReq = new NextRequest('http://localhost:3000/api/ledger?date=2026-09-17');
      const getRes = await getLedgerHandler(getReq);
      const getData = await getRes.json();
      const targetRecord = getData.records[0];

      const patchReq = new NextRequest('http://localhost:3000/api/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: targetRecord.id,
          deliveredQuantity: 2.0,
          status: 'DELIVERED',
          bottlesReturned: 2,
          notes: 'Placed in cooler box at door',
          changedBy: 'Farmer Suresh',
        }),
      });

      const patchRes = await patchLedgerHandler(patchReq);
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.success).toBe(true);
      expect(patchData.record.id).toBe(targetRecord.id);
      expect(patchData.record.deliveredQuantity).toBe(2.0);
      expect(patchData.record.status).toBe('DELIVERED');
      expect(patchData.record.bottlesReturned).toBe(2);
      expect(patchData.record.notes).toBe('Placed in cooler box at door');
      expect(patchData.record.billableAmount).toBe(2.0 * targetRecord.pricePerUnit);
    });

    it('should reject requests missing recordId with status 400', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveredQuantity: 1.0,
        }),
      });

      const patchRes = await patchLedgerHandler(patchReq);
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(400);
      expect(patchData.success).toBe(false);
      expect(patchData.error).toContain('recordId is required');
    });

    it('should return 404 if recordId does not exist', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: 'non_existent_record_9999',
          deliveredQuantity: 1.0,
        }),
      });

      const patchRes = await patchLedgerHandler(patchReq);
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(404);
      expect(patchData.success).toBe(false);
    });
  });
});
