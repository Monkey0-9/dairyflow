import { describe, it, expect } from 'vitest';
import { calculateInventoryReconciliation } from '@/lib/services/inventory.service';
import { computeStatementBalance } from '@/lib/services/billing.service';
import { generateAIDemandForecast, calculateDemandPlanning } from '@/lib/ai-forecasting';
import { notificationEngine } from '@/lib/services/notification.service';
import { GET as getCustomer360Handler } from '@/app/api/customer/360/route';
import { GET as getFarmerAnalyticsHandler } from '@/app/api/analytics/farmer/route';
import { NextRequest } from 'next/server';
import { encodeSignedSession, SessionUser, SESSION_COOKIE_NAME } from '@/lib/auth';

describe('Stages 13–20: Business Intelligence, Advanced Billing & Operational Engines', () => {
  // =========================================================================
  // STAGE 13: Inventory Reconciliation
  // =========================================================================
  describe('Stage 13: Operational Inventory Reconciliation Equation', () => {
    it('accurately balances dairy stock and computes variance and root-cause analysis', () => {
      // Opening: 100L, Prod: 750L, Purchases: 50L, TransfersIn: 10L = Inflow: 910L
      // Deliveries: 840L, Wastage: 10L, Personal: 5L, TransfersOut: 5L = Outflow: 860L
      // Expected Closing = 910 - 860 = 50L
      // Actual Closing = 42L -> Variance = -8L (Deficit)
      const res = calculateInventoryReconciliation({
        date: '2026-09-18',
        openingStock: 100.0,
        production: 750.0,
        purchases: 50.0,
        transfersIn: 10.0,
        deliveries: 840.0,
        wastage: 10.0,
        personalConsumption: 5.0,
        transfersOut: 5.0,
        actualClosing: 42.0,
      });

      expect(res.expectedClosing).toBe(50.0);
      expect(res.actualClosing).toBe(42.0);
      expect(res.variance).toBe(-8.0);
      expect(res.status).toBe('DEFICIT');
      expect(res.rootCauses.length).toBeGreaterThan(0);
      expect(res.rootCauses[0]).toContain('discrepancy');
    });

    it('identifies balanced inventory when variance is zero', () => {
      const res = calculateInventoryReconciliation({
        date: '2026-09-18',
        openingStock: 20.0,
        production: 100.0,
        deliveries: 100.0,
        actualClosing: 20.0,
      });

      expect(res.expectedClosing).toBe(20.0);
      expect(res.actualClosing).toBe(20.0);
      expect(res.variance).toBe(0.0);
      expect(res.status).toBe('BALANCED');
    });
  });

  // =========================================================================
  // STAGE 14: Advanced Billing Equation & Adjustments
  // =========================================================================
  describe('Stage 14: Advanced Billing & Customer Statement Equation', () => {
    it('computes Opening Balance + Current Charges + Adjustments - Payments = Closing Balance', () => {
      const balance = computeStatementBalance({
        openingBalance: 250.0, // Carry-forward unpaid from last month
        currentCharges: 1800.0, // 30 days * 60 Rs
        adjustments: -120.0, // Credit note for 2 missed days
        payments: 1500.0, // Paid via UPI
      });

      // 250 + 1800 - 120 - 1500 = 430.00
      expect(balance.closingBalance).toBe(430.0);
      expect(balance.status).toBe('PARTIALLY_PAID');
    });

    it('flags OVERPAID status when payments exceed total charges', () => {
      const balance = computeStatementBalance({
        openingBalance: 0.0,
        currentCharges: 600.0,
        adjustments: 0.0,
        payments: 700.0,
      });

      expect(balance.closingBalance).toBe(-100.0);
      expect(balance.status).toBe('OVERPAID');
    });
  });

  // =========================================================================
  // STAGE 15: Customer 360 Intelligence Profile
  // =========================================================================
  describe('Stage 15: Customer 360 Profile API', () => {
    it('returns complete consumption, financial, and churn intelligence profile', async () => {
      const sessionUser: SessionUser = {
        userId: 'usr_c_360',
        name: 'Ravi Kumar',
        role: 'CUSTOMER',
        tenantId: 'tenant_greenvalley',
        customerId: 'cust_ravi',
      };
      const token = encodeSignedSession(sessionUser);

      const req = new NextRequest('http://localhost:3000/api/customer/360?customerId=cust_ravi', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getCustomer360Handler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.customer360.customerId).toBe('cust_ravi');
      expect(json.customer360.consumption).toBeDefined();
      expect(json.customer360.financials).toBeDefined();
      expect(json.customer360.churnIntelligence).toBeDefined();
    });
  });

  // =========================================================================
  // STAGE 16: Advanced Farmer Analytics
  // =========================================================================
  describe('Stage 16: Advanced Farmer Analytics API', () => {
    it('aggregates daily litres by milk type, collection rate, and churn cohort', async () => {
      const farmerUser: SessionUser = {
        userId: 'usr_f_analytics',
        name: 'Farmer Suresh',
        role: 'FARMER',
        tenantId: 'tenant_greenvalley',
        farmerId: 'f_01',
      };
      const token = encodeSignedSession(farmerUser);

      const req = new NextRequest('http://localhost:3000/api/analytics/farmer?timeframe=this_month', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getFarmerAnalyticsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.volumes.totalLitresDelivered).toBeGreaterThanOrEqual(0);
      expect(json.financials.collectionPercentage).toBeDefined();
      expect(json.operationalHealth.skipRatePercentage).toBeDefined();
      expect(json.customerCohort.activeCustomersCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // STAGE 18: Demand Planning Engine
  // =========================================================================
  describe('Stage 18: Demand Planning & Procurement Engine', () => {
    it('computes daily procurement requirements based on forecast + safety buffer', () => {
      const forecast = generateAIDemandForecast();
      const plan = calculateDemandPlanning(forecast);

      expect(plan.targetDate).toBe(forecast.targetDate);
      expect(plan.items.length).toBe(3); // Cow, Buffalo, A2
      expect(plan.totalProcurementNeeded).toBeGreaterThanOrEqual(0);

      const cowPlan = plan.items.find((i) => i.milkType === 'Cow');
      expect(cowPlan).toBeDefined();
      expect(cowPlan?.forecastDemand).toBe(forecast.cowMilkDemand);
      expect(cowPlan?.safetyStock).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // STAGE 20: Omnichannel Notification Engine
  // =========================================================================
  describe('Stage 20: Omnichannel Notification Fan-Out', () => {
    it('fans out domain events to In-App, SMS, WhatsApp, and Email channels', () => {
      notificationEngine.clearQueue();

      const messages = notificationEngine.dispatch('invoice:generated', {
        recipientId: 'cust_001',
        recipientName: 'Sunita Rao',
        phone: '+919876543210',
        email: 'sunita@example.com',
        tenantId: 'tenant_01',
        data: { amount: 1450.0, month: 'September 2026', dueDate: '2026-09-28' },
      });

      // Must produce In-App, WhatsApp, and Email for invoice:generated
      expect(messages.length).toBe(3);
      const channels = messages.map((m) => m.channel);
      expect(channels).toContain('IN_APP');
      expect(channels).toContain('WHATSAPP');
      expect(channels).toContain('EMAIL');

      expect(messages[0].body).toContain('Sunita Rao');
      expect(messages[0].body).toContain('1450');
    });

    it('enqueues SMS notifications for urgent missed delivery events', () => {
      const messages = notificationEngine.dispatch('delivery:missed', {
        recipientId: 'cust_002',
        recipientName: 'Karan Mehra',
        phone: '+919811122233',
        tenantId: 'tenant_01',
        data: { reason: 'Building gate locked' },
      });

      const channels = messages.map((m) => m.channel);
      expect(channels).toContain('SMS');
      expect(channels).toContain('IN_APP');
      expect(channels).toContain('WHATSAPP');
    });
  });
});
