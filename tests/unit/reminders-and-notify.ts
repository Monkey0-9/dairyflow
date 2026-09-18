import { describe, it, expect } from 'vitest';
import { buildReminderMessage, buildWhatsAppLink } from '@/lib/reminders';
import { sendCustomerMessage, sendSms, sendPaymentReminder } from '@/lib/notify/provider';
import { checkRateLimit, resetRateLimit } from '@/lib/security/rate-limiter';

describe('Unit: multilingual reminders', () => {
  it('builds English reminder with amount', () => {
    const msg = buildReminderMessage({ customerName: 'Ravi', amount: 350 });
    expect(msg).toContain('Ravi');
    expect(msg).toContain('₹350');
  });

  it('builds Hindi reminder', () => {
    const msg = buildReminderMessage({ customerName: 'Ravi', amount: 350, lang: 'hi', dairyName: 'GreenValley' });
    expect(msg).toContain('नमस्ते');
    expect(msg).toContain('₹350');
  });

  it('builds Marathi reminder', () => {
    const msg = buildReminderMessage({ customerName: 'Ravi', amount: 350, lang: 'mr' });
    expect(msg).toContain('नमस्कार');
    expect(msg).toContain('₹350');
  });

  it('normalizes 10-digit numbers to +91 wa.me links', () => {
    const url = buildWhatsAppLink('98234 56780', 'hello');
    expect(url.startsWith('https://wa.me/919823456780')).toBe(true);
    expect(url).toContain(encodeURIComponent('hello'));
  });

  it('keeps longer international numbers as-is', () => {
    const url = buildWhatsAppLink('+1 555 123 4567', 'hi');
    expect(url.startsWith('https://wa.me/15551234567')).toBe(true);
  });
});

describe('Unit: notify provider safety', () => {
  it('sendCustomerMessage never touches network in test env', async () => {
    const res = await sendCustomerMessage('919823456780', 'test');
    expect(res.sent).toBe(false);
    expect(res.reason).toContain('test-env');
  });

  it('sendPaymentReminder resolves without throwing when unconfigured', async () => {
    const res = await sendPaymentReminder({ phone: '919823456780', customerName: 'Ravi', amount: 100 });
    expect(res.whatsapp.success).toBe(false);
    expect(res.sms.success).toBe(false);
  });

  it('sendSms reports test-env without network in tests', async () => {
    const res = await sendSms('919823456780', 'test');
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('test-env');
  });
});

describe('Unit: rate limiter', () => {
  it('allows up to the limit then blocks', () => {
    const key = `test_limit_${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetTimeSeconds).toBeGreaterThan(0);
    resetRateLimit(key);
  });

  it('reset restores allowance', () => {
    const key = `test_reset_${Date.now()}`;
    checkRateLimit(key, 1, 60);
    expect(checkRateLimit(key, 1, 60).allowed).toBe(false);
    resetRateLimit(key);
    expect(checkRateLimit(key, 1, 60).allowed).toBe(true);
    resetRateLimit(key);
  });
});
