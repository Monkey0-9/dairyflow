import { describe, it, expect, beforeEach } from 'vitest';
import { generateAIDemandForecast } from '@/lib/ai-forecasting';
import { resetTestStore } from '../setup';

describe('Component Testing: AI Demand Forecasting Engine', () => {
  beforeEach(() => {
    resetTestStore();
  });

  it('should generate complete comprehensive demand forecast', async () => {
    const forecast = await generateAIDemandForecast();

    expect(forecast).toBeDefined();
    expect(forecast.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(forecast.tomorrowDemand).toBeGreaterThan(0);
    expect(forecast.recommendedProduction).toBeGreaterThanOrEqual(forecast.tomorrowDemand);
    expect(forecast.safetyStockLitres).toBeGreaterThan(0);
    expect(forecast.recommendedMilkingTarget).toBe(forecast.recommendedProduction);
    expect(forecast.safetyBufferLitres).toBe(forecast.safetyStockLitres);
  });

  it('should generate 7-day forecast with daily details and confidence scores', async () => {
    const forecast = await generateAIDemandForecast();
    expect(forecast.sevenDayForecast).toHaveLength(7);

    forecast.sevenDayForecast.forEach((dayItem: any) => {
      expect(dayItem.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dayItem.dayName).toBeTruthy();
      expect(dayItem.predictedDemandLitres).toBeGreaterThan(0);
      expect(dayItem.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(dayItem.confidenceScore).toBeLessThanOrEqual(100);
      expect(dayItem.factors.length).toBeGreaterThan(0);
    });
  });

  it('should project product demand split (Cow, Buffalo, A2)', async () => {
    const forecast = await generateAIDemandForecast();
    expect(forecast.cowMilkDemand).toBeGreaterThan(0);
    expect(forecast.buffaloMilkDemand).toBeGreaterThan(0);
    expect(forecast.a2MilkDemand).toBeGreaterThan(0);
  });

  it('should generate explainable churn risks and anomaly indicators', async () => {
    const forecast = await generateAIDemandForecast();
    expect(forecast.churnRisks.length).toBeGreaterThanOrEqual(0);

    forecast.churnRisks.forEach((risk: any) => {
      expect(risk.customerId).toBeTruthy();
      expect(risk.customerName).toBeTruthy();
      expect(risk.riskScore).toBeGreaterThanOrEqual(0);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(risk.riskLevel);
      expect(risk.factualIndicators.length).toBeGreaterThan(0);
      expect(risk.recommendedAction).toBeTruthy();
    });

    expect(forecast.anomalies.length).toBe(forecast.churnRisks.length);
  });
});
