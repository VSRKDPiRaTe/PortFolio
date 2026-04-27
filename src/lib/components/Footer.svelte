<!--
  Footer.svelte
  ─────────────────────────────────────────────────────────────────
  Svelte note: setInterval inside onMount, cleared in onDestroy.
  Same pattern as React's useEffect with a cleanup return.

  SECRET OWNER ACCESS:
    Clicking the heart ♥ 3 times within 2 seconds triggers navigation
    to /owner-login. This is a hidden entry point — not visible in UI.
    Real security is still handled by server-side auth.

    Why heart?
      - Natural, non-obvious UI element
      - Always visible
      - Low accidental trigger probability
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { SITE_NAME } from "$lib/config.js";
  import { goto } from "$app/navigation";

  // ── Secret Entry Logic ──────────────────────────────────────────
  let secretClicks = 0;
  let secretTimer;

  function handleSecretEntry() {
    secretClicks += 1;

    clearTimeout(secretTimer);
    secretTimer = setTimeout(() => {
      secretClicks = 0;
    }, 2000);

    if (secretClicks >= 3) {
      secretClicks = 0;
      window.open("/owner-login", "_blank", "noopener,noreferrer");
    }
  }

  // ── Uptime Counter ──────────────────────────────────────────────
  let uptime = "00:00:00";
  const start = Date.now();
  let interval;

  onMount(() => {
    interval = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      uptime = `${h}:${m}:${sec}`;
    }, 1000);
  });

  onDestroy(() => clearInterval(interval));
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
      SYS.UPTIME: {uptime} // BUILD: v2.0.0-svelte
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
