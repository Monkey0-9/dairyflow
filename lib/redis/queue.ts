import { redisCommand } from './client';

export interface QueueJob<T = unknown> {
  id: string;
  enqueuedAt: string;
  payload: T;
}

/**
 * Background job queue for decoupled notification dispatch (SMS, WhatsApp, Email).
 * Decouples external messaging gateway latency from PostgreSQL ACID transaction commits.
 */

export async function enqueueJob<T>(queueName: string, payload: T): Promise<boolean> {
  const job: QueueJob<T> = {
    id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    enqueuedAt: new Date().toISOString(),
    payload,
  };

  try {
    const serialized = JSON.stringify(job);
    const res = await redisCommand<number>('RPUSH', `queue:${queueName}`, serialized);
    return (res ?? 0) > 0;
  } catch (err) {
    console.warn(`[Redis Queue] Enqueue failed for ${queueName}:`, err);
    return false;
  }
}

export async function dequeueJob<T>(queueName: string): Promise<QueueJob<T> | null> {
  try {
    const raw = await redisCommand<string>('LPOP', `queue:${queueName}`);
    if (!raw) return null;
    return JSON.parse(raw) as QueueJob<T>;
  } catch {
    return null;
  }
}

export async function getQueueLength(queueName: string): Promise<number> {
  try {
    const len = await redisCommand<number>('LLEN', `queue:${queueName}`);
    return len ?? 0;
  } catch {
    return 0;
  }
}
