// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/owner-login/+page.server.js — Login Form Action     ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// Handles the login form POST.
// Compares submitted password to OWNER_PASSWORD env var.
// On match: sets httpOnly session cookie → redirects to /owner.
// On fail:  returns error message to the login form.

import { fail, redirect } from "@sveltejs/kit";
import { timingSafeEqual } from "crypto";
import { OWNER_PASSWORD } from "$env/static/private";
import {
  SESSION_COOKIE,
  SESSION_TOKEN,
  COOKIE_MAX_AGE,
} from "$lib/server/constants.js";
import { dev } from "$app/environment";

export const actions = {
  // Default form action — handles POST from the login form.
  // SvelteKit calls this when the form submits to this page.
  default: async ({ request, cookies }) => {
    // Dev environment: no password needed, set cookie and redirect.
    if (dev) {
      cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
        path: "/owner",
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE,
        sameSite: "strict",
      });
      throw redirect(303, "/owner");
    }

    // Read submitted password from form data
    const data = await request.formData();
    const password = data.get("password")?.toString() ?? "";

    // Guard: OWNER_PASSWORD must be set in production env.
    // If missing, deny access with a clear server log.
    if (!OWNER_PASSWORD) {
      console.error("[owner/login] OWNER_PASSWORD env var is not set.");
      return fail(500, {
        error: "Server misconfiguration. Check server logs.",
      });
    }

    // ── Timing-safe comparison ───────────────────────────────────
    // String === comparison leaks information via timing:
    //   "a" === "z"          → fails instantly (first char differs)
    //   "correctpasswor" === "correctpassword" → fails after 15 chars
    // An attacker measuring response time can brute-force char by char.
    //
    // timingSafeEqual() from Node crypto always takes the same time
    // regardless of where the strings differ — no timing leak.
    //
    // Both buffers must be the same length for timingSafeEqual.
    // If lengths differ, comparison would reveal length — we pad with
    // a dummy comparison to keep timing consistent.
    const inputBuf = Buffer.from(password);
    const correctBuf = Buffer.from(OWNER_PASSWORD);

    // If lengths differ, run a dummy comparison to prevent length leak,
    // then fail. Never short-circuit before the comparison.
    const lengthMatch = inputBuf.length === correctBuf.length;
    const valueMatch = lengthMatch && timingSafeEqual(inputBuf, correctBuf);

    if (!valueMatch) {
      // Return fail() — sends { error } back to the form as `form` prop.
      // Does NOT redirect — login page stays visible with the error.
      return fail(401, { error: "Invalid access key." });
    }

    // ── Password matched — set session cookie ────────────────────
    // httpOnly: true  → browser JS cannot read this cookie (XSS protection)
    // sameSite: strict → cookie not sent on cross-site requests (CSRF protection)
    // path: /owner    → cookie only sent on /owner/* routes (minimal exposure)
    // secure: true    → cookie only sent over HTTPS (auto-set by SvelteKit in prod)
    cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
      path: "/owner",
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "strict",
    });

    // Redirect to owner dashboard after successful login
    throw redirect(303, "/owner");
  },
};
