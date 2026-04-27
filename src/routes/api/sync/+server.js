import { addSyncClient } from '$lib/server/sync-hub.js';

export function GET() {
  const encoder = new TextEncoder();

  let closed = false;
  let removeClient = null;
  let ping = null;

  function cleanup() {
    if (closed) return;
    closed = true;

    if (ping) {
      clearInterval(ping);
      ping = null;
    }

    if (removeClient) {
      removeClient();
      removeClient = null;
    }
  }

  function safeEnqueue(controller, chunk) {
    if (closed) return;

    try {
      controller.enqueue(chunk);
    } catch {
      cleanup();
    }
  }

  function encodeEvent(event, data) {
    return encoder.encode(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      safeEnqueue(controller, encodeEvent('connected', { ok: true }));

      removeClient = addSyncClient((type) => {
        safeEnqueue(controller, encodeEvent('sync', { type }));
      });

      ping = setInterval(() => {
        safeEnqueue(controller, encoder.encode(': ping\n\n'));
      }, 20000);
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
    },
  });
}