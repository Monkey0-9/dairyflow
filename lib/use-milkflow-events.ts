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
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    try {
      source = new EventSource('/api/events');
      source.onmessage = (msg) => {
        try {
          const raw = JSON.parse(msg.data) as { type?: string };
          if (!raw.type || raw.type === 'connected') return;
          handlerRef.current(raw as MilkFlowEvent);
        } catch {
          // ignore malformed frames / heartbeats
        }
      };
      source.onerror = () => {
        // EventSource auto-retries; close only when page unloads (cleanup below)
      };
    } catch {
      // SSE unavailable (offline) — silent
    }
    return () => {
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
