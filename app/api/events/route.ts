import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { subscribeEvents, eventVisibleTo, getRecentEvents, readOutbox } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match ? decodeURIComponent(match[1]) : undefined);

  const scope = {
    tenantId: session?.tenantId,
    farmerId: session?.farmerId,
    customerId: session?.customerId,
    userId: session?.userId,
    role: session?.role,
  };

  const url = new URL(req.url);
  const isPoll = url.searchParams.get('poll') === 'true' || req.headers.get('accept')?.includes('application/json');
  if (isPoll) {
    const since = url.searchParams.get('since');
    const sinceMs = since ? new Date(since).getTime() : 0;
    // Merge in-memory history (same instance) with the Redis outbox
    // (other serverless instances), dedupe, scope-filter, and sort.
    const outbox = await readOutbox(scope.tenantId).catch(() => []);
    const seen = new Set<string>();
    const merged = [...getRecentEvents(50), ...outbox].filter((evt) => {
      if (!eventVisibleTo(evt, scope)) return false;
      if (since && !(new Date(evt.timestamp).getTime() > sinceMs)) return false;
      const key = `${evt.type}|${evt.timestamp}|${JSON.stringify(evt.payload || {})}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return Response.json({ success: true, events: merged.slice(-20), timestamp: new Date().toISOString() });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch (_closeErr) {
          // Stream already closed or aborted by client
        }
      };

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (_sendErr) {
          cleanup();
        }
      };

      // Initial hello + recent history (scoped)
      send({ type: 'connected', timestamp: new Date().toISOString() });
      for (const evt of getRecentEvents(10)) {
        if (eventVisibleTo(evt, scope)) send(evt);
      }

      const unsubscribe = subscribeEvents((event) => {
        if (eventVisibleTo(event, scope)) send(event);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (_beatErr) {
          cleanup();
        }
      }, 25000);

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
