<!--
  src/routes/owner-login/+page.svelte — Owner Login Page
  Only shown when DEV_FLAGS.skipOwnerAuth is false.
  Dev environment with PUBLIC_DEV_STRICT=false skips to /owner directly.
-->
<script>
  import '../../../app.css';
  import { enhance } from '$app/forms';

  let loading = $state(false);
  let error   = $state('');

  let { form } = $props();

  $effect(() => {
    if (form?.error) error = form.error;
  });
</script>

<svelte:head>
  <title>Owner Login</title>
</svelte:head>

<div class="login-wrap">
  <div class="login-box">

    <div class="login-header">
      <div class="login-logo">PORTFOLIO<span class="neon-m">.OS</span></div>
      <div class="login-sub">OWNER ACCESS REQUIRED</div>
    </div>

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        error   = '';
        return async ({ update }) => {
          loading = false;
          await update();
        };
      }}
    >
      <div class="field">
        <label class="field-label" for="password">ACCESS KEY</label>
        <input
          id="password"
          name="password"
          type="password"
          class="field-input"
          placeholder="Enter owner password"
          autocomplete="current-password"
          required
        />
      </div>

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}

      <button type="submit" class="login-btn" disabled={loading}>
        {loading ? 'AUTHENTICATING...' : 'ENTER'}
      </button>
    </form>

    <div class="login-footer">
      <a href="/" target="_blank" class="site-link">VIEW LIVE SITE →</a>
    </div>

  </div>
</div>

<style>
  /* ── Full page centering ─────────────────────────────────────────
     min-height: 100vh + flex centers the box vertically.
     padding ensures the box never touches screen edges on tiny screens. */
  .login-wrap {
    min-height: 100vh;
    background: #02040a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Share Tech Mono', monospace;
    padding: 1.5rem;  /* prevents box touching edges on very small screens */
    box-sizing: border-box;
  }

  /* ── Login box ───────────────────────────────────────────────────
     min(400px, 90vw) means:
       desktop → capped at 400px
       mobile  → 90% of viewport width (never overflows)
     The padding: 1.5rem on .login-wrap above gives extra breathing room. */
  .login-box {
    width: min(400px, 100%); /* 100% of .login-wrap content area (already 90vw on small) */
    border: 1px solid rgba(0,245,255,0.2);
    padding: 2.5rem;
    background: rgba(6,12,26,0.9);
    box-shadow: 0 0 40px rgba(0,245,255,0.06);
  }

  .login-header { text-align: center; margin-bottom: 2rem; }
  .login-logo   {
    font-family: 'Orbitron', monospace;
    font-size: clamp(1rem, 4vw, 1.2rem); /* scales on very small screens */
    font-weight: 900;
    color: var(--cyan);
    text-shadow: var(--glow-c);
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
  }
  .login-sub { font-size: 0.7rem; letter-spacing: 0.14em; color: rgba(168,184,216,0.4); text-transform: uppercase; }

  .field       { margin-bottom: 1.25rem; }
  .field-label { display: block; font-size: 0.65rem; letter-spacing: 0.15em; color: var(--cyan); margin-bottom: 0.5rem; }

  .field-input {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-hi);
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.85rem;
    padding: 0.7rem 0.9rem;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    /* Prevent iOS zoom on focus — font-size must be >= 16px on mobile
       or Safari zooms in. We keep 0.85rem but add this touch target fix. */
    -webkit-text-size-adjust: 100%;
  }

  .field-input:focus { border-color: var(--cyan); box-shadow: 0 0 0 1px rgba(0,245,255,0.2); }

  .error-msg { font-size: 0.72rem; color: var(--magenta); margin-bottom: 1rem; }

  .login-btn {
    width: 100%;
    padding: 0.8rem;
    background: transparent;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    cursor: pointer;
    transition: all 0.2s;
    text-shadow: var(--glow-c);
    /* Minimum touch target height — Apple recommends 44px minimum */
    min-height: 44px;
  }

  .login-btn:hover:not(:disabled) { background: rgba(0,245,255,0.08); box-shadow: var(--glow-c); }
  .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .login-footer {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255,255,255,0.06);
    text-align: center;
  }

  .site-link {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    color: rgba(168,184,216,0.35);
    text-decoration: none;
    transition: color 0.2s;
    /* Minimum touch target — add padding so tap area is larger than text */
    padding: 0.5rem 1rem;
    display: inline-block;
  }

  .site-link:hover { color: var(--cyan); }

  /* ── Small screens ───────────────────────────────────────────────
     Reduce box padding on very small phones. */
  @media (max-width: 380px) {
    .login-box { padding: 1.5rem; }
  }
</style>