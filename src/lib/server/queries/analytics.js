// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/queries/analytics.js                             ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Server-only analytics query layer.
//   Tracks public portfolio visits and exposes dashboard-ready analytics
//   for the Owner Interface.
//
// IMPORTANT ARCHITECTURE RULE:
//   This file does NOT create tables.
//   Table creation belongs in:
//     scripts/schema.sql
//     one-time DB migration SQL
//
//   This file only:
//     - decides whether a request should be tracked
//     - hashes visitor identity
//     - inserts/updates analytics rows
//     - reads analytics summary data
//
// PRIVACY-FIRST DESIGN:
//   We do NOT store raw IP addresses.
//
//   Instead:
//     normalized IP + user-agent + secret → HMAC SHA-256 hash
//
//   The stored visitor_key lets us count unique visitors without keeping
//   the original IP address.
//
// TABLES USED:
//
//   visitor_sessions
//     One row per anonymous unique visitor.
//     Same visitor revisiting the site updates this row instead of creating
//     a new unique visitor.
//
//   visitor_pageviews
//     One row per public page view.
//     Used for total pageviews, pageviews today, and top pages.
//
// COUNTING MODEL:
//   People Visited / totalUniqueVisitors:
//     Number of unique visitor_session rows.
//     Same visitor returning again does NOT increase this.
//
//   Views / totalPageviews:
//     Number of visitor_pageviews rows.
//     Same visitor refreshing or opening more pages DOES increase this.
//
// SERVER ONLY:
//   Never import this file inside .svelte components.

import crypto from "node:crypto";

import { VISITOR_HASH_SECRET } from "$env/static/private";
import { db } from "$lib/server/db.js";
import { notifyAnalyticsChanged } from "$lib/server/sync-events.js";

// ── hashValue ─────────────────────────────────────────────────────
// HMAC is better than a plain hash because only the server knows the secret.
// Even if someone sees visitor_key in the DB, they cannot reverse it back
// into the original IP/user-agent.
function hashValue(value) {
  return crypto
    .createHmac("sha256", VISITOR_HASH_SECRET)
    .update(value)
    .digest("hex");
}

// ── nowSeconds ────────────────────────────────────────────────────
// Unix timestamp in seconds.
// SQLite unixepoch() also uses seconds, so this keeps JS and DB aligned.
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// ── startOfTodaySeconds ───────────────────────────────────────────
// Start of the current UTC day as Unix seconds.
//
// UTC keeps analytics stable across deployments and server environments.
// Later, if you want NZ-local dashboard days, we can add timezone-aware
// grouping separately.
function startOfTodaySeconds() {
  const now = new Date();

  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  return Math.floor(start.getTime() / 1000);
}

// ── getClientIp ───────────────────────────────────────────────────
// Attempts to read the visitor IP from common proxy/CDN headers first.
//
// x-forwarded-for:
//   Common when deployed behind proxies/load balancers.
//   May contain multiple IPs. First one is usually the original client.
//
// x-real-ip:
//   Common with Nginx/reverse proxies.
//
// cf-connecting-ip:
//   Cloudflare's original visitor IP header.
//
// event.getClientAddress():
//   SvelteKit fallback.
function getClientIp(event) {
  const forwardedFor = event.request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = event.request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cloudflareIp = event.request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp.trim();

  try {
    return event.getClientAddress();
  } catch {
    return "unknown";
  }
}

// ── normalizeIp ───────────────────────────────────────────────────
// Normalises unstable local/private IP values before hashing.
//
// WHY THIS EXISTS:
//   In local dev, the same browser can sometimes appear as:
//     127.0.0.1
//     ::1
//     ::ffff:127.0.0.1
//
//   If we hash those raw values directly, one real person can become
//   multiple "unique visitors".
//
//   Normalising makes local/dev counting stable.
//
// NOTE:
//   We still do NOT store this IP value. It is only used to create the
//   anonymous visitor_key hash.
function normalizeIp(ip) {
  if (!ip || ip === "unknown") return "unknown";

  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost"
  ) {
    return "local-dev";
  }

  if (
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  ) {
    return "local-network";
  }

  return ip;
}

// ── isLocalIp ─────────────────────────────────────────────────────
// Used only for location display decisions.
//
// Local/dev requests cannot be geolocated correctly, so we show:
//   Local / Local Network
function isLocalIp(ip) {
  return ip === "unknown" || ip === "local-dev" || ip === "local-network";
}

// ── getLocationFromHeaders ────────────────────────────────────────
// V1 location support.
//
// In local dev:
//   Location will normally be Local / Local Network.
//
// In production:
//   Some platforms/CDNs provide location headers automatically.
//
// Cloudflare:
//   cf-ipcountry
//
// Vercel:
//   x-vercel-ip-country
//   x-vercel-ip-city
//
// NOTE:
//   City is not guaranteed. Country is much more common.
//   Full accurate city lookup requires a geolocation provider later.
function getLocationFromHeaders(event, normalizedIp) {
  if (isLocalIp(normalizedIp)) {
    return {
      country: "Local",
      city: "Local Network",
    };
  }

  const country =
    event.request.headers.get("cf-ipcountry") ||
    event.request.headers.get("x-vercel-ip-country") ||
    null;

  const rawCity = event.request.headers.get("x-vercel-ip-city") || null;

  let city = rawCity;

  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      city = rawCity;
    }
  }

  return {
    country,
    city,
  };
}

// ── shouldTrackRequest ────────────────────────────────────────────
// Filters out requests that should NOT count as public site visits.
//
// We track:
//   - GET requests
//   - successful public HTML pages
//
// We ignore:
//   - owner interface
//   - owner login
//   - API routes
//   - static assets
//   - dev/internal browser requests
//   - failed responses
export function shouldTrackRequest(event, response) {
  const { pathname } = event.url;

  if (event.request.method !== "GET") return false;

  // Owner/admin should not count as public portfolio visitors.
  if (pathname.startsWith("/owner")) return false;
  if (pathname.startsWith("/owner-login")) return false;

  // API calls are not page visits.
  if (pathname.startsWith("/api")) return false;

  // Ignore common browser/dev/static requests.
  if (pathname === "/favicon.ico") return false;
  if (pathname.startsWith("/.well-known")) return false;
  if (pathname.startsWith("/@vite")) return false;
  if (pathname.startsWith("/node_modules")) return false;

  // Ignore obvious static assets by file extension.
  if (
    /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|ttf|json)$/i.test(
      pathname,
    )
  ) {
    return false;
  }

  // Only count successful responses.
  if (!response || response.status >= 400) return false;

  // Only count HTML page responses.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html")) return false;

  return true;
}

// ── trackPublicVisit ──────────────────────────────────────────────
// Main tracking function called by src/hooks.server.js.
//
// What it does:
//
//   1. Reads raw visitor IP from request/proxy headers.
//   2. Normalises local/private IPs for stable counting.
//   3. Builds anonymous visitor_key:
//        normalized IP + user-agent → HMAC hash
//   4. Upserts visitor_sessions:
//        first visit creates row
//        repeat visit updates last_seen_at, last_path, pageviews
//   5. Inserts visitor_pageviews:
//        every tracked page load gets its own row
//   6. Notifies connected owner dashboards that analytics changed.
//
// Same visitor behavior:
//   - People Visited / unique visitor count does NOT increase
//   - Views / pageview count DOES increase
export async function trackPublicVisit(event) {
  const rawIp = getClientIp(event);
  const ip = normalizeIp(rawIp);

  const userAgent = event.request.headers.get("user-agent") ?? "unknown";
  const referrer = event.request.headers.get("referer") ?? null;
  const path = event.url.pathname;
  const now = nowSeconds();

  const { country, city } = getLocationFromHeaders(event, ip);

  // IMPORTANT UNIQUE VISITOR RULE:
  //   Same normalized IP + same browser/user-agent = same anonymous visitor.
  //
  // This means:
  //   same person refreshing page     → same visitor_key
  //   same person visiting later      → same visitor_key
  //   different browser/device        → different visitor_key
  //
  // This is conservative, privacy-friendly analytics without login/cookies.
  const visitorKey = hashValue(`${ip}|${userAgent}`);

  // Insert one anonymous visitor row.
  // If the visitor already exists, update latest activity instead.
  //
  // Unique visitor count remains stable because visitor_key is UNIQUE.
  //
  // pageviews is also incremented here as a quick per-visitor total.
  // The detailed pageview history is stored separately in visitor_pageviews.
  await db.execute({
    sql: `
      INSERT INTO visitor_sessions (
        visitor_key,
        first_seen_at,
        last_seen_at,
        first_path,
        last_path,
        pageviews,
        user_agent,
        referrer,
        country,
        city
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(visitor_key) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        last_path    = excluded.last_path,
        pageviews    = visitor_sessions.pageviews + 1,
        country      = COALESCE(excluded.country, visitor_sessions.country),
        city         = COALESCE(excluded.city, visitor_sessions.city)
    `,
    args: [
      visitorKey,
      now,
      now,
      path,
      path,
      userAgent,
      referrer,
      country,
      city,
    ],
  });

  // Insert one pageview row for traffic history/top-pages analytics.
  //
  // This is intentionally separate from unique visitors.
  // A single visitor can create many pageviews.
  await db.execute({
    sql: `
      INSERT INTO visitor_pageviews (
        visitor_key,
        path,
        viewed_at,
        referrer
      )
      VALUES (?, ?, ?, ?)
    `,
    args: [visitorKey, path, now, referrer],
  });

  notifyAnalyticsChanged();
}

// ── getAnalyticsSummary ───────────────────────────────────────────
// Returns dashboard-ready analytics numbers.
//
// Used by:
//   src/routes/(ownerapp)/owner/+page.server.js
//
// Returned shape:
//   {
//     totalUniqueVisitors,
//     uniqueToday,
//     totalPageviews,
//     pageviewsToday,
//     topPages,
//     recentVisits
//   }
export async function getAnalyticsSummary() {
  const todayStart = startOfTodaySeconds();

  const [
    totalUnique,
    uniqueToday,
    totalPageviews,
    pageviewsToday,
    topPages,
    recentVisits,
  ] = await Promise.all([
    // People Visited:
    // One row per unique visitor.
    db.execute(`
      SELECT COUNT(*) AS count
      FROM visitor_sessions
    `),

    // Unique people whose first visit happened today.
    db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM visitor_sessions
        WHERE first_seen_at >= ?
      `,
      args: [todayStart],
    }),

    // Views:
    // Every tracked public page load.
    db.execute(`
      SELECT COUNT(*) AS count
      FROM visitor_pageviews
    `),

    // Views today.
    db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM visitor_pageviews
        WHERE viewed_at >= ?
      `,
      args: [todayStart],
    }),

    // Most viewed public routes.
    db.execute(`
      SELECT path, COUNT(*) AS views
      FROM visitor_pageviews
      GROUP BY path
      ORDER BY views DESC
      LIMIT 5
    `),

    // Latest unique visitors.
    db.execute(`
      SELECT
        last_path,
        last_seen_at,
        pageviews,
        country,
        city
      FROM visitor_sessions
      ORDER BY last_seen_at DESC
      LIMIT 8
    `),
  ]);

  return {
    totalUniqueVisitors: Number(totalUnique.rows[0]?.count ?? 0),
    uniqueToday: Number(uniqueToday.rows[0]?.count ?? 0),
    totalPageviews: Number(totalPageviews.rows[0]?.count ?? 0),
    pageviewsToday: Number(pageviewsToday.rows[0]?.count ?? 0),

    topPages: topPages.rows.map((row) => ({
      path: row.path,
      views: Number(row.views ?? 0),
    })),

    recentVisits: recentVisits.rows.map((row) => ({
      path: row.last_path,
      lastSeen: Number(row.last_seen_at ?? 0),
      pageviews: Number(row.pageviews ?? 0),
      country: row.country ?? null,
      city: row.city ?? null,
    })),
  };
}
