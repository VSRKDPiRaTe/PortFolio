// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/hooks.server.js — Global Server Request Hook                ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   A global SvelteKit server hook.
//   It runs for every incoming request before/around route handling.
//
// WHY WE USE THIS FOR VISITOR ANALYTICS:
//   Visitor analytics should be centralised.
//   We do NOT want to manually call trackVisitor() inside every page.
//
//   The hook lets us say:
//     "If this request is a public page visit, record it."
//
// FLOW:
//   Request arrives
//     → resolve(event) lets SvelteKit render the route
//     → if response is a successful public HTML page
//     → trackPublicVisit(event)
//
// IMPORTANT:
//   Tracking happens after resolve(event), so if the page errors or is not
//   a public HTML response, it will not be counted.
//
//   Tracking is fire-and-forget. Analytics failure should never break the
//   public portfolio page.

import {
  shouldTrackRequest,
  trackPublicVisit,
} from '$lib/server/queries/analytics.js';

export async function handle({ event, resolve }) {
  const response = await resolve(event);

  if (shouldTrackRequest(event, response)) {
    // Fire-and-forget:
    //   Do not delay the user response just because analytics is writing.
    //   Log errors server-side only.
    trackPublicVisit(event).catch((err) => {
      console.error('[analytics] Failed to track visit:', err.message);
    });
  }

  return response;
}