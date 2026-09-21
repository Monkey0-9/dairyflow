import { describe, it, expect, beforeEach } from 'vitest';
import {
  sendEmailNotification,
  getEmailOutbox,
  clearEmailOutbox,
  renderDairyEmailTemplate,
} from '@/lib/notifications/email-provider';
import { notificationService } from '@/lib/services/notification.service';

describe('Integration: FR-NOT-001 Transactional Email Notification Provider', () => {
  beforeEach(() => {
    clearEmailOutbox();
    notificationService.clearQueue();
  });

  it('renders a pristine dairy email template with security and aesthetic branding', () => {
    const html = renderDairyEmailTemplate({
      title: 'Monthly Milk Settlement - September 2026',
      recipientName: 'Vikram Mehta',
      body: 'Your total delivered milk for September 2026 is 62.5 Litres. Total invoice amount is ₹4,375.00.',
      highlightText: '₹4,375.00',
      actionUrl: 'https://milkflow.app/portal/bills',
      actionText: 'View & Pay Invoice',
    });

    expect(html).toContain('MilkFlow Private Reserve');
    expect(html).toContain('Monthly Milk Settlement - September 2026');
    expect(html).toContain('Hello Vikram Mehta,');
    expect(html).toContain('₹4,375.00');
    expect(html).toContain('https://milkflow.app/portal/bills');
    expect(html).toContain('View & Pay Invoice');
    expect(html).toContain('Automated single-estate fulfillment notification.');
  });

  it('delivers transactional email to sandbox outbox when credentials are not configured', async () => {
    const res = await sendEmailNotification({
      to: 'vikram.mehta@example.com',
      subject: 'MilkFlow: Payment Receipt - ₹1500',
      text: 'Payment of ₹1500 received via UPI for MilkFlow dairy.',
      tenantId: 't_sandbox_01',
      metadata: { invoiceId: 'inv_101', amount: 1500 },
    });

    expect(res.success).toBe(true);
    expect(res.provider).toBe('SANDBOX');
    expect(res.messageId).toContain('sbx_');

    const outbox = getEmailOutbox({ to: 'vikram.mehta@example.com' });
    expect(outbox.length).toBe(1);
    expect(outbox[0].subject).toBe('MilkFlow: Payment Receipt - ₹1500');
    expect(outbox[0].tenantId).toBe('t_sandbox_01');
    expect(outbox[0].metadata?.amount).toBe(1500);
  });

  it('dispatches emails automatically via omnichannel NotificationEngine on invoice generation', async () => {
    const { messages, emailResult } = await notificationService.dispatchAsync('invoice:generated', {
      recipientId: 'cust_991',
      recipientName: 'Ananya Sharma',
      email: 'ananya.sharma@example.com',
      phone: '9876500000',
      tenantId: 'tenant_coop_01',
      data: {
        month: 'September 2026',
        amount: 2850,
        dueDate: '2026-10-05',
      },
    });

    // Check queued multi-channel fan-out
    expect(messages.length).toBeGreaterThanOrEqual(2); // In-App + Email (+ WhatsApp if eligible)
    const emailMsg = messages.find((m) => m.channel === 'EMAIL');
    expect(emailMsg).toBeDefined();
    expect(emailMsg?.recipient).toBe('ananya.sharma@example.com');
    expect(emailMsg?.subject).toContain('Monthly Milk Bill');

    // Check transactional email delivery
    expect(emailResult).toBeDefined();
    expect(emailResult?.success).toBe(true);

    const outbox = getEmailOutbox({ to: 'ananya.sharma@example.com' });
    expect(outbox.length).toBe(1);
    expect(outbox[0].subject).toContain('Monthly Milk Bill');
    expect(outbox[0].html).toContain('₹2850');
  });

  it('properly records and filters outbox messages by tenant and recipient', async () => {
    await sendEmailNotification({
      to: 'tenant1.user@example.com',
      subject: 'Tenant 1 Notice',
      text: 'Notice 1',
      tenantId: 'tenant_1',
    });

    await sendEmailNotification({
      to: 'tenant2.user@example.com',
      subject: 'Tenant 2 Notice',
      text: 'Notice 2',
      tenantId: 'tenant_2',
    });

    expect(getEmailOutbox().length).toBe(2);
    expect(getEmailOutbox({ tenantId: 'tenant_1' }).length).toBe(1);
    expect(getEmailOutbox({ tenantId: 'tenant_2' }).length).toBe(1);
    expect(getEmailOutbox({ to: 'tenant1.user@example.com' }).length).toBe(1);
  });
});
