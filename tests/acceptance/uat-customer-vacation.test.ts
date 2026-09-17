import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-02): Customer Self-Service Vacation Pause & Resumption', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Scenario: Customer schedules 4-day holiday pause; daily deliveries skip without charge and resume automatically', () => {
    const customerId = 'cust_ravi';
    const vacationStart = '2026-09-20';
    const vacationEnd = '2026-09-23';

    // Step 1: Customer activates vacation pause via customer self-service
    const pause = store.scheduleVacationPause(
      customerId,
      vacationStart,
      vacationEnd,
      'Family trip to hills'
    );

    expect(pause).toBeDefined();
    expect(pause.status).toBe('ACTIVE');
    expect(pause.startDate).toBe(vacationStart);
    expect(pause.endDate).toBe(vacationEnd);

    // Step 2: During vacation (e.g. Sep 21), system automatically marks delivery as SKIPPED
    const ledgerDuringVacation = store.getOrGenerateDailyLedger('2026-09-21');
    const raviDuring = ledgerDuringVacation.find((r) => r.customerId === customerId);

    expect(raviDuring).toBeDefined();
    expect(raviDuring?.status).toBe('SKIPPED');
    expect(raviDuring?.deliveredQuantity).toBe(0.0);
    expect(raviDuring?.billableAmount).toBe(0.0);
    expect(raviDuring?.reason).toBe('Scheduled Vacation Pause');
    expect(raviDuring?.markedBy).toBe('SYSTEM_AUTO');

    // Step 3: During vacation (e.g. Sep 22), system continues skipping delivery
    const ledgerDay2 = store.getOrGenerateDailyLedger('2026-09-22');
    const raviDay2 = ledgerDay2.find((r) => r.customerId === customerId);
    expect(raviDay2?.status).toBe('SKIPPED');
    expect(raviDay2?.billableAmount).toBe(0.0);

    // Step 4: After vacation ends (Sep 24), system automatically resumes standard delivery
    const ledgerAfterVacation = store.getOrGenerateDailyLedger('2026-09-24');
    const raviAfter = ledgerAfterVacation.find((r) => r.customerId === customerId);

    expect(raviAfter).toBeDefined();
    expect(raviAfter?.status).toBe('DELIVERED');
    expect(raviAfter?.deliveredQuantity).toBe(1.0);
    expect(raviAfter?.billableAmount).toBe(50.0);

    // Step 5: Verification of month invoice shows zero billing for skipped vacation days
    const invoice = store.recalculateMonthlyInvoice(customerId, 9, 2026);
    expect(invoice).not.toBeNull();
    // Billable quantity matches only active days
    expect(invoice?.totalQuantity).toBeLessThan(30.0);
  });
});
