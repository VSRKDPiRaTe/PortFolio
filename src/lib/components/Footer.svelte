<!--
  Footer.svelte
  ─────────────────────────────────────────────────────────────────
  Svelte note:
    setInterval runs inside onMount and is cleared in onDestroy.
    Same pattern as React's useEffect with a cleanup return.

  SECRET OWNER ACCESS:
    Triggers navigation to /owner-login. This is a hidden entry point.
    Real security is still handled by server-side auth.

  DEPLOYMENT UPTIME:
    SYS.UPTIME shows how long the current deployment/build has been alive.

    Production:
      Uses PUBLIC_DEPLOYED_AT from environment variables.
      Example:
        PUBLIC_DEPLOYED_AT=2026-04-27T00:00:00.000Z

    Development:
      If PUBLIC_DEPLOYED_AT is missing or invalid, it falls back to Date.now().
      That means local dev behaves like the old version:
        uptime = time since this browser tab/component mounted.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { SITE_NAME } from "$lib/config.js";
  import { PUBLIC_DEPLOYED_AT, PUBLIC_BUILD_LABEL } from "$env/static/public";

  // ── Secret Entry Logic ──────────────────────────────────────────
  let secretClicks = 0;
  let secretTimer;

  function handleSecretEntry() {
    secretClicks += 1;

    clearTimeout(secretTimer);

    // Reset click count if the owner does not complete 3 clicks quickly.
    secretTimer = setTimeout(() => {
      secretClicks = 0;
    }, 2000);

    if (secretClicks >= 3) {
      secretClicks = 0;

      // Open in new tab so the public site remains open.
      window.open("/owner-login", "_blank", "noopener,noreferrer");
    }
  }

  // ── Uptime Counter ──────────────────────────────────────────────
  let uptime = "00:00:00";
  let interval;

  // PUBLIC_DEPLOYED_AT is injected at build/deploy time.
  // If it is missing locally, Date.parse(undefined) returns NaN.
  const deployedAt = Date.parse(PUBLIC_DEPLOYED_AT);

  // Production:
  //   start = deployment timestamp
  //
  // Development / fallback:
  //   start = current browser time
  const start = Number.isFinite(deployedAt) ? deployedAt : Date.now();

  // Converts milliseconds into a readable uptime string.
  //
  // Under 1 day:
  //   04:12:09
  //
  // Over 1 day:
  //   2D 04:12:09
  function formatUptime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));

    const days = Math.floor(total / 86400);
    const hours = String(Math.floor((total % 86400) / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const seconds = String(total % 60).padStart(2, "0");

    return days > 0
      ? `${days}D ${hours}:${minutes}:${seconds}`
      : `${hours}:${minutes}:${seconds}`;
  }

  function tickUptime() {
    uptime = formatUptime(Date.now() - start);
  }

  onMount(() => {
    // Run once immediately so the footer does not wait 1 second
    // before showing the correct uptime.
    tickUptime();

    interval = setInterval(tickUptime, 1000);
  });

  onDestroy(() => {
    clearInterval(interval);
    clearTimeout(secretTimer);
  });
</script>

<footer class="border-t border-white/10 py-8 bg-bg">
  <div
    class="max-w-6xl mx-auto px-8 flex flex-wrap items-center justify-between gap-4"
  >
    <p
      class="font-mono text-[0.7rem] tracking-widest"
      style="color: rgba(168,184,216,0.4);"
    >
      © 2025 {SITE_NAME} — CRAFTED WITH

      <button
        type="button"
        onclick={handleSecretEntry}
        class="secret-heart"
        aria-label="Owner access"
      >
        ♥
      </button>

      & EXCESSIVE CHOCOLATE
    </p>

    <p
      class="font-mono text-[0.65rem] tracking-widest"
      style="color: rgba(168,184,216,0.25);"
    >
      SYS.UPTIME: {uptime} // BUILD: {PUBLIC_BUILD_LABEL}
    </p>
  </div>
</footer>

<style>
  .secret-heart {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: var(--magenta);
    font-size: 1.5rem;
    font-family: inherit;
    font-weight: inherit;
    line-height: 1;
    vertical-align: middle;
    cursor: default;
    user-select: none;
  }

  .secret-heart:hover {
    color: var(--magenta); /* no hover color change */
  }

  .secret-heart:focus {
    outline: none; /* no focus ring */
    box-shadow: none;
  }

  .secret-heart:active {
    transform: scale(0.9);
  }
</style>
