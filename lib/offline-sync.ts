'use client';

/**
 * Offline-first IndexedDB queue for delivery mutations.
 * Store: milkflow_offline_queue (keyPath: queueId, autoIncrement).
 */

export interface QueuedDeliveryMutation {
  queueId?: number;
  recordId: string;
  customerId?: string;
  date?: string;
  deliveredQuantity?: number;
  status?: string;
  reason?: string;
  notes?: string;
  bottlesReturned?: number;
  queuedAt: string;
}

const DB_NAME = 'milkflow';
const STORE = 'milkflow_offline_queue';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'queueId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function queueDeliveryMutation(m: Omit<QueuedDeliveryMutation, 'queueId' | 'queuedAt'>): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.add({ ...m, queuedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(Number(req.result));
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function listQueuedMutations(): Promise<QueuedDeliveryMutation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as QueuedDeliveryMutation[]) || []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

export async function clearQueuedMutation(queueId: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(queueId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Drain queue by dispatching PATCH /api/ledger per mutation.
 * Returns { flushed, remaining }.
 */
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
  const pending = await listQueuedMutations();
  let flushed = 0;
  for (const m of pending) {
    try {
      const res = await fetch('/api/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: m.recordId,
          deliveredQuantity: m.deliveredQuantity,
          status: m.status,
          reason: m.reason,
          notes: m.notes,
          bottlesReturned: m.bottlesReturned,
        }),
      });
      if (res.ok && m.queueId !== undefined) {
        await clearQueuedMutation(m.queueId);
        flushed += 1;
      }
    } catch {
      break; // still offline — stop draining
    }
  }
  const remaining = (await listQueuedMutations()).length;
  return { flushed, remaining };
}

/**
 * Register the service worker (idempotent).
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
