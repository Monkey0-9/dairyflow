/**
 * MilkFlow 2.0 Omnichannel Notification Engine (Stage 20)
 * Fan-out architecture: Event -> Notification Service -> Channel Queue
 * Channels: In-App, Email, SMS, WhatsApp
 */

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

export type NotificationTriggerEvent =
  | 'invoice:generated'
  | 'payment:received'
  | 'payment:overdue'
  | 'pause:approved'
  | 'pause:rejected'
  | 'extra_milk:approved'
  | 'delivery:missed'
  | 'dispute:resolved';

export interface NotificationPayload {
  recipientId: string;
  recipientName: string;
  phone?: string;
  email?: string;
  tenantId: string;
  data: Record<string, unknown>;
}

export interface QueuedMessage {
  id: string;
  channel: NotificationChannel;
  event: NotificationTriggerEvent;
  recipient: string;
  subject?: string;
  body: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  enqueuedAt: string;
  dispatchedAt?: string;
}

class NotificationEngine {
  private queue: QueuedMessage[] = [];

  public dispatch(event: NotificationTriggerEvent, payload: NotificationPayload): QueuedMessage[] {
    const messages: QueuedMessage[] = [];
    const timestamp = new Date().toISOString();

    // 1. In-App Notification (Universal)
    const inAppBody = this.renderBody(event, payload);
    messages.push({
      id: `ntf_app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      channel: 'IN_APP',
      event,
      recipient: payload.recipientId,
      body: inAppBody,
      status: 'SENT',
      enqueuedAt: timestamp,
      dispatchedAt: timestamp,
    });

    // 2. WhatsApp Notification (Direct customer messaging)
    if (payload.phone) {
      messages.push({
        id: `ntf_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        channel: 'WHATSAPP',
        event,
        recipient: payload.phone,
        body: this.renderBody(event, payload),
        status: 'SENT',
        enqueuedAt: timestamp,
        dispatchedAt: timestamp,
      });
    }

    // 3. SMS Notification (Fallback / Transactional alert)
    if (payload.phone && (event === 'payment:received' || event === 'payment:overdue' || event === 'delivery:missed')) {
      messages.push({
        id: `ntf_sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        channel: 'SMS',
        event,
        recipient: payload.phone,
        body: this.renderBody(event, payload),
        status: 'SENT',
        enqueuedAt: timestamp,
        dispatchedAt: timestamp,
      });
    }

    // 4. Email Notification (Formal invoicing & disputes)
    if (payload.email && (event === 'invoice:generated' || event === 'payment:received' || event === 'dispute:resolved')) {
      messages.push({
        id: `ntf_eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        channel: 'EMAIL',
        event,
        recipient: payload.email,
        subject: this.renderSubject(event, payload),
        body: this.renderBody(event, payload),
        status: 'SENT',
        enqueuedAt: timestamp,
        dispatchedAt: timestamp,
      });
    }

    this.queue.push(...messages);
    return messages;
  }

  public getQueue(): QueuedMessage[] {
    return this.queue;
  }

  public clearQueue() {
    this.queue = [];
  }

  private renderSubject(event: NotificationTriggerEvent, payload: NotificationPayload): string {
    switch (event) {
      case 'invoice:generated':
        return `MilkFlow: Monthly Milk Bill - ${payload.data.month || 'Current Month'}`;
      case 'payment:received':
        return `MilkFlow: Payment Receipt - ₹${payload.data.amount || '0'}`;
      case 'dispute:resolved':
        return `MilkFlow: Dispute Resolution Update`;
      default:
        return `MilkFlow Notification`;
    }
  }

  private renderBody(event: NotificationTriggerEvent, payload: NotificationPayload): string {
    const name = payload.recipientName;
    const d = payload.data;

    switch (event) {
      case 'invoice:generated':
        return `Hello ${name}, your milk invoice for ₹${d.amount} is generated and due on ${d.dueDate || 'month end'}.`;
      case 'payment:received':
        return `Hello ${name}, we received your payment of ₹${d.amount} (Ref: ${d.transactionRef}). Thank you!`;
      case 'payment:overdue':
        return `Friendly reminder ${name}: an outstanding milk bill of ₹${d.amount} is overdue. Please settle via UPI.`;
      case 'pause:approved':
        return `Hello ${name}, your milk pause request from ${d.startDate} to ${d.endDate} has been approved by your farmer.`;
      case 'pause:rejected':
        return `Hello ${name}, your milk pause request was not approved: ${d.reason || 'Contact farmer'}.`;
      case 'extra_milk:approved':
        return `Hello ${name}, your extra milk order for ${d.quantity}L on ${d.date} is confirmed for morning delivery.`;
      case 'delivery:missed':
        return `Attention ${name}: Morning milk delivery could not be dropped: ${d.reason || 'Gate locked'}. Please check with delivery agent.`;
      case 'dispute:resolved':
        return `Hello ${name}, your delivery adjustment request has been resolved. Credit adjusted: ₹${d.creditAmount || '0'}.`;
    }
  }
}

export const notificationEngine = new NotificationEngine();
