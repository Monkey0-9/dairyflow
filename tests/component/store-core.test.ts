import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore, getStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Component Testing: Store Core Domain Logic', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  describe('Customer Management', () => {
    it('should initialize with default demo customers', () => {
      expect(store.customers.length).toBeGreaterThan(0);
      const ravi = store.customers.find((c) => c.id === 'cust_ravi');
      expect(ravi).toBeDefined();
      expect(ravi?.name).toBe('Ravi Kumar');
      expect(ravi?.customerCode).toBe('MK-1024');
      expect(ravi?.active).toBe(true);
    });

    it('should allow retrieving active customer profiles', () => {
      const activeCustomers = store.customers.filter((c) => c.active);
      expect(activeCustomers.length).toBeGreaterThan(0);
      activeCustomers.forEach((c) => {
        expect(c.tenantId).toBe(store.tenantId);
        expect(c.qrToken).toBeTruthy();
      });
    });
  });

  describe('Subscription & Scheduled Daily Ledger', () => {
    it('should generate scheduled ledger entries for active customers on scheduled days', () => {
      // 2026-09-17 is Thursday (THU)
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      expect(ledger.length).toBeGreaterThan(0);

      const raviRecord = ledger.find((r) => r.customerId === 'cust_ravi');
      expect(raviRecord).toBeDefined();
      expect(raviRecord?.scheduledQuantity).toBe(1.0);
      expect(raviRecord?.pricePerUnit).toBe(50.0);
    });

    it('should respect Delivery Sequence ordering for the route', () => {
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      for (let i = 0; i < ledger.length - 1; i++) {
        const custA = store.customers.find((c) => c.id === ledger[i].customerId);
        const custB = store.customers.find((c) => c.id === ledger[i + 1].customerId);
        expect(custA!.deliverySequence).toBeLessThanOrEqual(custB!.deliverySequence);
      }
    });
  });

  describe('Server-Side Billable Calculation Invariants', () => {
    it('should calculate billableAmount = deliveredQuantity * pricePerUnit on DELIVERED', () => {
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      const rec = ledger[0];

      const res = store.updateDeliveryRecord(
        rec.id,
        { status: 'DELIVERED', deliveredQuantity: 2.0 },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
      );

      expect(res.record).not.toBeNull();
      expect(res.record?.status).toBe('DELIVERED');
      expect(res.record?.deliveredQuantity).toBe(2.0);
      expect(res.record?.billableAmount).toBe(2.0 * rec.pricePerUnit);
    });

    it('should enforce billableAmount = 0 and deliveredQuantity = 0 when status is SKIPPED', () => {
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      const rec = ledger[0];

      const res = store.updateDeliveryRecord(
        rec.id,
        { status: 'SKIPPED', deliveredQuantity: 2.0, reason: 'Customer requested skip' },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
      );

      expect(res.record).not.toBeNull();
      expect(res.record?.status).toBe('SKIPPED');
      expect(res.record?.deliveredQuantity).toBe(0.0);
      expect(res.record?.billableAmount).toBe(0.0);
    });

    it('should enforce billableAmount = 0 when status is NOT_DELIVERED', () => {
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      const rec = ledger[0];

      const res = store.updateDeliveryRecord(
        rec.id,
        { status: 'NOT_DELIVERED', reason: 'Farm truck breakdown' },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
      );

      expect(res.record).not.toBeNull();
      expect(res.record?.status).toBe('NOT_DELIVERED');
      expect(res.record?.billableAmount).toBe(0.0);
    });

    it('should accurately calculate billableAmount for PARTIAL deliveries', () => {
      const ledger = store.getOrGenerateDailyLedger('2026-09-17');
      const rec = ledger[0];

      const res = store.updateDeliveryRecord(
        rec.id,
        { status: 'PARTIAL', deliveredQuantity: 0.5, reason: 'Took half quantity' },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
      );

      expect(res.record).not.toBeNull();
      expect(res.record?.status).toBe('PARTIAL');
      expect(res.record?.deliveredQuantity).toBe(0.5);
      expect(res.record?.billableAmount).toBe(0.5 * rec.pricePerUnit);
    });
  });

  describe('Vacation Pauses & Temporary Quantity Overrides', () => {
    it('should automatically set status to SKIPPED and billableAmount = 0 during active vacation window', () => {
      // Add a vacation pause for cust_ravi from 2026-09-20 to 2026-09-25
      store.vacationPauses.push({
        id: 'vac_test_01',
        tenantId: store.tenantId,
        customerId: 'cust_ravi',
        startDate: '2026-09-20',
        endDate: '2026-09-25',
        reason: 'Out of town wedding',
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
      });

      const ledgerDuringVacation = store.getOrGenerateDailyLedger('2026-09-22');
      const raviRec = ledgerDuringVacation.find((r) => r.customerId === 'cust_ravi');

      expect(raviRec).toBeDefined();
      expect(raviRec?.status).toBe('SKIPPED');
      expect(raviRec?.deliveredQuantity).toBe(0.0);
      expect(raviRec?.billableAmount).toBe(0.0);
      expect(raviRec?.reason).toBe('Scheduled Vacation Pause');
      expect(raviRec?.markedBy).toBe('SYSTEM_AUTO');
    });

    it('should apply temporary quantity overrides on specified dates', () => {
      // Temporary boost for cust_suresh on 2026-09-22
      store.tempQuantityChanges.push({
        id: 'temp_test_01',
        tenantId: store.tenantId,
        customerId: 'cust_suresh',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
        overrideQuantity: 3.0,
        reason: 'Family festival gathering',
      });

      const ledger = store.getOrGenerateDailyLedger('2026-09-22');
      const sureshRec = ledger.find((r) => r.customerId === 'cust_suresh');

      expect(sureshRec).toBeDefined();
      expect(sureshRec?.scheduledQuantity).toBe(3.0);
      expect(sureshRec?.deliveredQuantity).toBe(3.0);
      expect(sureshRec?.status).toBe('EXTRA');
      expect(sureshRec?.billableAmount).toBe(3.0 * sureshRec!.pricePerUnit);
    });
  });

  describe('Day Lock and Immutability Safeguards', () => {
    it('should prevent standard delivery updates when date is locked as FINALIZED', () => {
      const date = '2026-09-17';
      store.getOrGenerateDailyLedger(date);
      store.dayLockStatusMap.set(date, 'FINALIZED');

      const rec = store.deliveryRecords.get(`del_${date}_cust_ravi`)!;
      const result = store.updateDeliveryRecord(
        rec.id,
        { deliveredQuantity: 5.0 },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
      );

      expect(result.record).toBeNull();
      expect(result.error).toContain('FINALIZED');
    });

    it('should permit modifications if allowAdjustmentOnLocked is explicitly authorized', () => {
      const date = '2026-09-17';
      store.getOrGenerateDailyLedger(date);
      store.dayLockStatusMap.set(date, 'FINALIZED');

      const rec = store.deliveryRecords.get(`del_${date}_cust_ravi`)!;
      const result = store.updateDeliveryRecord(
        rec.id,
        { deliveredQuantity: 1.5 },
        { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' },
        true // allowAdjustmentOnLocked
      );

      expect(result.record).not.toBeNull();
      expect(result.record?.deliveredQuantity).toBe(1.5);
    });
  });
});
