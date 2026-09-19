import { describe, it, expect } from 'vitest';
import { llmProvider, groundedAnswer } from '@/lib/ai-llm';
import { tFor, I18N_LANGS, I18nKey } from '@/lib/i18n';

const EN_KEYS: I18nKey[] = [
  'brand.tag', 'brand.sub', 'nav.today', 'nav.yesterday', 'nav.notifications',
  'nav.unread', 'nav.markAllRead', 'nav.noNotif', 'nav.switchPersona', 'nav.language',
  'tab.daily', 'tab.calendar', 'tab.customers', 'tab.billing', 'tab.disputes',
  'tab.requests', 'tab.pricing', 'tab.forecast', 'tab.audit', 'tab.routes',
  'tab.inventory', 'ctab.home', 'ctab.calendar', 'ctab.billing', 'ctab.vacation',
  'admin.banner', 'cust.welcome', 'cust.liveUpdate', 'cust.portal',
  'farmer.needsAttention', 'farmer.customerRequests', 'farmer.openDispute',
  'farmer.pendingBilling', 'farmer.exceptionsToday', 'farmer.scheduledDemand',
  'farmer.deliveredMilk', 'farmer.pending', 'farmer.exceptionsSkips',
  'login.title', 'login.subtitle', 'login.phone', 'login.password', 'login.signIn',
  'login.newHere', 'billing.title', 'billing.reminder', 'billing.sendReminder',
];

describe('Unit: i18n dictionary completeness', () => {
  it('supports en, hi, mr', () => {
    expect(I18N_LANGS).toEqual(['en', 'hi', 'mr']);
  });

  it('every key resolves non-empty in all languages', () => {
    for (const lang of I18N_LANGS) {
      for (const key of EN_KEYS) {
        const val = tFor(lang, key);
        expect(typeof val, `${lang}:${key}`).toBe('string');
        expect(val.length, `${lang}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('hi/mr actually differ from en (translations present)', () => {
    let hiDiff = 0;
    let mrDiff = 0;
    for (const key of EN_KEYS) {
      if (tFor('hi', key) !== tFor('en', key)) hiDiff += 1;
      if (tFor('mr', key) !== tFor('en', key)) mrDiff += 1;
    }
    expect(hiDiff).toBeGreaterThan(EN_KEYS.length / 2);
    expect(mrDiff).toBeGreaterThan(EN_KEYS.length / 2);
  });
});

describe('Unit: LLM copilot layer', () => {
  it('reports no provider under VITEST', () => {
    expect(llmProvider()).toBeNull();
  });

  it('groundedAnswer resolves null without keys (rule-engine fallback)', async () => {
    const savedA = process.env.ANTHROPIC_API_KEY;
    const savedG = process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await expect(groundedAnswer('How much milk?', { total: 7 })).resolves.toBeNull();
    } finally {
      if (savedA !== undefined) process.env.ANTHROPIC_API_KEY = savedA;
      if (savedG !== undefined) process.env.GEMINI_API_KEY = savedG;
    }
  });
});
