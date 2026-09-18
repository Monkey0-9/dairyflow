import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { subscribeEvents, eventVisibleTo, getRecentEvents } from '@/lib/events';

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

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client gone */ }
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
        } catch { /* ignore */ }
      }, 25000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch { /* already closed */ }
      };

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
