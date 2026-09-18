import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as copilot } from '@/app/api/ai/copilot/route';

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/ai/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('System: POST /api/ai/copilot', () => {
  it('answers procurement questions with litre figures', async () => {
    const res = await copilot(post({ query: 'How much Buffalo milk do I need for tomorrow morning?' }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('procurement');
    expect(data.answer).toMatch(/L/);
    expect(typeof data.total).toBe('number');
  });

  it('reports overdue bills', async () => {
    const res = await copilot(post({ query: 'Which customers have unpaid bills older than 15 days?' }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('overdue');
    expect(Array.isArray(data.customers)).toBe(true);
  });

  it('reports chronic skippers', async () => {
    const res = await copilot(post({ query: 'Show me customers who skipped more than 5 deliveries this month.' }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('skippers');
    expect(Array.isArray(data.customers)).toBe(true);
  });

  it('generates a localized reminder in reminder mode', async () => {
    const res = await copilot(
      post({ query: 'remind', mode: 'reminder', customerId: 'cust_ravi', amount: 120, lang: 'hi' })
    );
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('reminder');
    expect(data.message).toContain('₹120');
  });

  it('falls back to help for unknown questions', async () => {
    const res = await copilot(post({ query: 'what is the weather today' }));
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.type).toBe('help');
  });
});
