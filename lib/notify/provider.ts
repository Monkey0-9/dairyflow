/**
 * MilkFlow omnichannel sender: Meta WhatsApp Cloud API (+ SMS fallback).
 *
 * Modes via NOTIFY_PROVIDER: 'auto' (default) | 'whatsapp' | 'sms' | 'off'.
 * All sends are inert when credentials are absent or under VITEST — they
 * return { sent: false } with a reason instead of throwing, so cron jobs
 * and tests stay hermetic.
 */

export type NotifyChannel = 'whatsapp' | 'sms';
export type NotifyProviderMode = 'auto' | 'whatsapp' | 'sms' | 'off';

export interface SendResult {
  sent: boolean;
  channel?: NotifyChannel;
  providerId?: string;
  reason?: string;
}

function mode(): NotifyProviderMode {
  const m = (process.env.NOTIFY_PROVIDER || 'auto').toLowerCase();
  return m === 'whatsapp' || m === 'sms' || m === 'off' ? m : 'auto';
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Send via Meta WhatsApp Cloud API. Uses an approved utility template when
 * WA_TEMPLATE_NAME is set (required for business-initiated messages),
 * otherwise a free-form text (works inside the 24h customer-service window).
 */
export async function sendWhatsApp(to: string, message: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_PROVIDER_KEY;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  if (process.env.VITEST === 'true') return { sent: false, reason: 'test-env' };
  if (!token || !phoneNumberId) return { sent: false, reason: 'whatsapp-not-configured' };
  try {
    const template = process.env.WA_TEMPLATE_NAME;
    const body = template
      ? {
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'template',
          template: {
            name: template,
            language: { code: process.env.WA_TEMPLATE_LANG || 'en' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: message.slice(0, 1000) }] },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'text',
          text: { body: message.slice(0, 4000) },
        };
    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, channel: 'whatsapp', reason: `meta-${res.status}: ${text.slice(0, 160)}` };
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { sent: true, channel: 'whatsapp', providerId: data.messages?.[0]?.id };
  } catch (err) {
    return { sent: false, channel: 'whatsapp', reason: err instanceof Error ? err.message : 'network-error' };
  }
}

/**
 * Generic transactional SMS sender. Configure SMS_API_URL + SMS_API_KEY;
 * posts { to, message } JSON with a Bearer key by default. Adapt the mapping
 * to your provider (MSG91/Fast2SMS) without changing callers.
 */
export async function sendSms(to: string, message: string): Promise<SendResult> {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_PROVIDER_KEY;
  if (process.env.VITEST === 'true') return { sent: false, reason: 'test-env' };
  if (!url || !key) return { sent: false, reason: 'sms-not-configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        [process.env.SMS_API_KEY_HEADER || 'Authorization']: key.startsWith('Bearer ') ? key : `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: normalizePhone(to), message: message.slice(0, 1000) }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, channel: 'sms', reason: `sms-${res.status}: ${text.slice(0, 160)}` };
    }
    return { sent: true, channel: 'sms' };
  } catch (err) {
    return { sent: false, channel: 'sms', reason: err instanceof Error ? err.message : 'network-error' };
  }
}

/**
 * Router: WhatsApp first, SMS fallback (or forced single channel).
 * Never throws; always resolves with a result.
 */
export async function sendCustomerMessage(to: string, message: string): Promise<SendResult> {
  const m = mode();
  if (m === 'off' || !to || !message) return { sent: false, reason: m === 'off' ? 'provider-off' : 'missing-recipient-or-body' };
  if (process.env.VITEST === 'true') return { sent: false, reason: 'test-env' };
  if (m === 'sms') return sendSms(to, message);
  const wa = await sendWhatsApp(to, message);
  if (wa.sent || m === 'whatsapp') return wa;
  const sms = await sendSms(to, message);
  if (sms.sent) return sms;
  return { sent: false, reason: `all-channels-failed (${wa.reason || 'wa'} / ${sms.reason || 'sms'})` };
}

export interface PaymentReminderResult {
  whatsapp: { success: boolean; messageId?: string; reason?: string };
  sms: { success: boolean; reason?: string };
}

/**
 * High-level billing reminder: localized message + WhatsApp-first dispatch
 * with SMS fallback. Shape matches /api/notifications/remind expectations.
 */
export async function sendPaymentReminder(params: {
  phone: string;
  customerName: string;
  amount: number;
  lang?: 'en' | 'hi' | 'mr';
  payLink?: string;
}): Promise<PaymentReminderResult> {
  const { buildReminderMessage } = await import('@/lib/reminders');
  const message = buildReminderMessage({
    customerName: params.customerName,
    amount: params.amount,
    lang: params.lang || 'en',
    payLink: params.payLink,
  });
  const m = mode();
  let whatsapp: PaymentReminderResult['whatsapp'] = { success: false, reason: 'skipped' };
  let sms: PaymentReminderResult['sms'] = { success: false, reason: 'skipped' };
  if (m === 'auto' || m === 'whatsapp') {
    const r = await sendWhatsApp(params.phone, message);
    whatsapp = { success: r.sent, messageId: r.providerId, reason: r.reason };
  }
  if ((m === 'auto' && !whatsapp.success) || m === 'sms') {
    const r = await sendSms(params.phone, message);
    sms = { success: r.sent, reason: r.reason };
  }
  return { whatsapp, sms };
}
