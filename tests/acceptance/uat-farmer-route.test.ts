import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-01): Farmer Morning Route Delivery Execution', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Scenario: Farmer Suresh executes daily morning route deliveries and handles exceptions', () => {
    const today = '2026-09-17';

    // Step 1: Farmer checks morning delivery sequence for the route
    const route = store.getOrGenerateDailyLedger(today);
    expect(route.length).toBeGreaterThanOrEqual(3);

    // Verify route is sequenced logically (1, 2, 3...)
    for (let i = 0; i < route.length - 1; i++) {
      const custA = store.customers.find((c) => c.id === route[i].customerId)!;
      const custB = store.customers.find((c) => c.id === route[i + 1].customerId)!;
      expect(custA.deliverySequence).toBeLessThanOrEqual(custB.deliverySequence);
    }

    // Step 2: Stop 1 - Farmer delivers standard quantity to First Customer (Ravi Kumar)
    const stop1 = route[0];
    const stop1Update = store.updateDeliveryRecord(
      stop1.id,
      {
        status: 'DELIVERED',
        deliveredQuantity: stop1.scheduledQuantity,
        bottlesReturned: 1,
      },
      { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
    );
    expect(stop1Update.record).not.toBeNull();
    expect(stop1Update.record?.status).toBe('DELIVERED');
    expect(stop1Update.record?.deliveredQuantity).toBe(stop1.scheduledQuantity);
    expect(stop1Update.record?.bottlesReturned).toBe(1);
    expect(stop1Update.record?.billableAmount).toBe(stop1.scheduledQuantity * stop1.pricePerUnit);

    // Step 3: Stop 2 - Customer requested less quantity (Partial Delivery)
    const stop2 = route[1];
    const stop2Update = store.updateDeliveryRecord(
      stop2.id,
      {
        status: 'PARTIAL',
        deliveredQuantity: 0.5,
        reason: 'Customer doorstep request: take 0.5L only',
        bottlesReturned: 2,
      },
      { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
    );
    expect(stop2Update.record).not.toBeNull();
    expect(stop2Update.record?.status).toBe('PARTIAL');
    expect(stop2Update.record?.deliveredQuantity).toBe(0.5);
    expect(stop2Update.record?.billableAmount).toBe(0.5 * stop2.pricePerUnit);
    expect(stop2Update.record?.bottlesReturned).toBe(2);

    // Step 4: Verify audit log captures delivery actions
    const latestAudit = store.auditChain[store.auditChain.length - 1];
    expect(latestAudit.entityType).toBe('DELIVERY_RECORD');
    expect(latestAudit.actor.role).toBe('FARMER');

    // Step 5: Route completion metrics
    const completedCount = route.filter(
      (r) => r.status === 'DELIVERED' || r.status === 'PARTIAL' || r.status === 'SKIPPED'
    ).length;
    expect(completedCount).toBeGreaterThanOrEqual(2);
  });
});
