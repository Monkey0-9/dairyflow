import { randomUUID } from 'crypto';

/**
 * Move 9: End-to-End Tracing & Observability.
 * Generates unique traceId/requestId carried from HTTP headers -> API route
 * -> Domain Service -> DB Query -> Audit Event log.
 */

export interface TraceContext {
  traceId: string;
  requestId: string;
  parentSpanId?: string;
  spanId: string;
  startedAt: string;
  tenantId?: string;
  actorId?: string;
}

export const TRACE_HEADER = 'x-milkflow-trace-id';
export const REQUEST_HEADER = 'x-milkflow-request-id';

export function newTraceId(): string {
  return `tr_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function newRequestId(): string {
  return `req_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function newSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export function startTrace(init?: { traceId?: string; requestId?: string; tenantId?: string; actorId?: string }): TraceContext {
  return {
    traceId: init?.traceId ?? newTraceId(),
    requestId: init?.requestId ?? newRequestId(),
    spanId: newSpanId(),
    startedAt: new Date().toISOString(),
    tenantId: init?.tenantId,
    actorId: init?.actorId,
  };
}

export function childSpan(ctx: TraceContext): TraceContext {
  return { ...ctx, parentSpanId: ctx.spanId, spanId: newSpanId() };
}

export function traceHeaders(ctx: TraceContext): Record<string, string> {
  return { [TRACE_HEADER]: ctx.traceId, [REQUEST_HEADER]: ctx.requestId };
}

export function extractTrace(headers: { get(name: string): string | null }): Pick<TraceContext, 'traceId' | 'requestId'> {
  return {
    traceId: headers.get(TRACE_HEADER) ?? newTraceId(),
    requestId: headers.get(REQUEST_HEADER) ?? newRequestId(),
  };
}

/** Structured log line coupling trace context to a domain event (audit sink). */
export function traceEvent(
  ctx: TraceContext,
  event: string,
  fields: Record<string, unknown> = {},
): { traceId: string; requestId: string; spanId: string; event: string; at: string } & Record<string, unknown> {
  return { traceId: ctx.traceId, requestId: ctx.requestId, spanId: ctx.spanId, event, at: new Date().toISOString(), ...fields };
}
