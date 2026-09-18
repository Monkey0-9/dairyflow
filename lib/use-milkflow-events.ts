'use client';

import { useEffect, useRef } from 'react';
import type { MilkFlowEvent } from '@/lib/events';

/**
 * Subscribe to MilkFlow SSE stream. Auto-reconnects via EventSource.
 */
export function useMilkFlowEvents(onEvent: (event: MilkFlowEvent) => void) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let source: EventSource | null = null;
    let lastSeenTimestamp = new Date().toISOString();
    let pollTimer: NodeJS.Timeout | null = null;

    const pollRecent = async () => {
      try {
        const res = await fetch(`/api/events?poll=true&since=${encodeURIComponent(lastSeenTimestamp)}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events)) {
            for (const evt of data.events) {
              if (evt.timestamp > lastSeenTimestamp) {
                lastSeenTimestamp = evt.timestamp;
              }
              handlerRef.current(evt);
            }
          }
          if (data.timestamp) {
            lastSeenTimestamp = data.timestamp;
          }
        }
      } catch {
        // network offline / transient
      }
    };

    if (typeof EventSource !== 'undefined') {
      try {
        source = new EventSource('/api/events');
        source.onmessage = (msg) => {
          try {
            const raw = JSON.parse(msg.data) as { type?: string; timestamp?: string };
            if (!raw.type || raw.type === 'connected') return;
            if (raw.timestamp && raw.timestamp > lastSeenTimestamp) {
              lastSeenTimestamp = raw.timestamp;
            }
            handlerRef.current(raw as MilkFlowEvent);
          } catch {
            // ignore malformed frames / heartbeats
          }
        };
        source.onerror = () => {
          // Fallback poll on SSE error
          pollRecent();
        };
      } catch {
        // SSE unavailable, rely on interval
      }
    }

    // Periodic safety poll every 20 seconds (ensures reliability across serverless instance reboots)
    pollTimer = setInterval(pollRecent, 20000);

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      try {
        source?.close();
      } catch { /* ignore */ }
    };
  }, []);
}

/**
 * Play a short notification chime via WebAudio (no asset files needed).
 */
export function playNotificationChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => void ctx.close();
  } catch {
    // audio unavailable — silent
  }
}
