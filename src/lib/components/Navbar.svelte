<script>
  // ── Imports ───────────────────────────────────────────────────────
  import { mobileNavOpen }  from '$lib/stores/ui.js';
  import { SITE_OWNER, STATUS_CURRENT } from '$lib/config.js';

  // ── Scroll Detection ─────────────────────────────────────────────
  // scrollY is bound to window.scrollY via <svelte:window bind:scrollY>.
  // $: is Svelte 4 reactive statement — re-runs whenever scrollY changes.
  // scrolled = true once user scrolls past 50px → triggers .scrolled styles
  // (solid background + backdrop blur + border).
  let scrollY = 0;
  $: scrolled = scrollY > 50;

  // ── Nav Links ─────────────────────────────────────────────────────
  // href values match the id= attributes on each section component.
  // Hero has id="hero", About has id="about" etc.
  // Clicking a link scrolls the page to that section anchor.
  const links = [
    { href: '#about',      label: 'ABOUT'      },
    { href: '#experience', label: 'EXPERIENCE' },
    { href: '#projects',   label: 'PROJECTS'   },
    { href: '#skills',     label: 'SKILLS'     },
  ];

  function closeNav() {
    mobileNavOpen.set(false);
  }
</script>


<!-- svelte:window binds scrollY to the window scroll position reactively.
     No event listeners needed — Svelte handles subscribe/unsubscribe. -->
<svelte:window bind:scrollY />


<nav class="nav-bar" class:scrolled>
  <div class="nav-inner">

    <!-- ── Logo + Status Badge ────────────────────────────────────────
      Logo links back to hero section (#hero).
      Status badge sits immediately after the logo text — same line.
      Only renders when STATUS_CURRENT.pulse is true (open/contract/opportunities).
      When status is 'closed', pulse=false → badge hidden entirely.
      The pulsing dot + label give visitors an instant availability signal
      without needing to scroll to the About section.
    ──────────────────────────────────────────────────────────────── -->
    <div class="logo-group">
      <a href="#hero" class="nav-logo">
        {SITE_OWNER}<span class="neon-m">.DEV</span>
      </a>

      <span class="status-badge">
        <!-- Pulsing dot — color and glow from STATUS_CURRENT in config.js.
              animation: blink defined in app.css @theme keyframes.
              box-shadow uses STATUS_CURRENT.glow for the neon ring effect. -->
        <span
          class="status-dot {STATUS_CURRENT.color}"
          class:animate-pulse={STATUS_CURRENT.pulse}
          style="box-shadow: {STATUS_CURRENT.glow};"
        ></span>
        <span class="status-label {STATUS_CURRENT.color}">
          {STATUS_CURRENT.label}
        </span>
      </span>
    </div>


    <!-- ── Desktop Nav Links ──────────────────────────────────────────
      Hidden on mobile via CSS (max-width: 768px).
      Hamburger button shown instead on small screens.
      Each link has an ::after pseudo-element that animates to full
      width on hover — creates the sliding underline effect.
    ──────────────────────────────────────────────────────────────── -->
    <ul class="nav-links">
      {#each links as link}
        <li><a href={link.href} class="nav-link">{link.label}</a></li>
      {/each}
    </ul>


    <!-- ── Hamburger Button ───────────────────────────────────────────
      Three <span> lines that animate into an X when nav is open.
      Visible only on mobile (display:none on desktop via CSS).
      .rot45 / .hidden / .rotneg45 classes applied via Svelte class: directive.
      class:rot45={$mobileNavOpen} = add class when store value is true.
    ──────────────────────────────────────────────────────────────── -->
    <button
      class="hamburger"
      on:click={() => mobileNavOpen.update(v => !v)}
      aria-label="Toggle navigation menu"
    >
      <span class:rot45={$mobileNavOpen}></span>
      <span class:hidden={$mobileNavOpen}></span>
      <span class:rotneg45={$mobileNavOpen}></span>
    </button>

  </div>


  <!-- ── Mobile Menu ────────────────────────────────────────────────
    {#if $mobileNavOpen} = Svelte conditional block.
    $mobileNavOpen = auto-subscribes to the store ($ prefix).
    Clicking any link calls closeNav() which sets store to false,
    collapsing this menu block.
  ──────────────────────────────────────────────────────────────── -->
  {#if $mobileNavOpen}
    <div class="mobile-menu">
      {#each links as link}
        <a href={link.href} on:click={closeNav} class="mobile-link">
          {link.label}
        </a>
      {/each}
    </div>
  {/if}

</nav>


<style>
  /* Fixed top nav — always visible, above all content */
  .nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 1.2rem 0;
    transition: all 0.4s;
  }

  /* Scrolled state — solid background appears after 50px scroll.
     backdrop-filter: blur gives the frosted glass effect.
     border-bottom adds the subtle cyan accent line. */
  .nav-bar.scrolled {
    background: rgba(2, 4, 10, 0.92);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(0, 245, 255, 0.15);
    padding: 0.8rem 0;
  }

  /* Inner container — max-width + centered + flex layout */
  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Logo group — wraps logo text + status badge on same line */
  .logo-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  /* Logo text — Orbitron font for the cyberpunk display style */
  .nav-logo {
    font-family: 'Orbitron', monospace;
    font-weight: 900;
    font-size: 1.1rem;
    color: var(--cyan);
    text-shadow: var(--glow-c);
    text-decoration: none;
    letter-spacing: 0.05em;
  }

  /* Status badge — pill container for dot + label */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    background: rgba(255,255,255,0.03);
  }

  /* Pulsing dot — color class applied dynamically from STATUS_CURRENT.color.
     animation: blink defined in app.css @theme.
     box-shadow set inline from STATUS_CURRENT.glow for the neon ring. */
  .status-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: blink 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* Status label text — small monospace, same color as dot */
  .status-label {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Desktop nav links list */
  .nav-links {
    display: flex;
    gap: 2.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Individual nav link */
  .nav-link {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #a8b8d8;
    text-decoration: none;
    transition: color 0.3s;
    position: relative;
  }

  /* Sliding underline on hover — animates from 0 to full width */
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 1px;
    background: var(--cyan);
    box-shadow: var(--glow-c);
    transition: width 0.3s;
  }

  .nav-link:hover { color: var(--cyan); text-shadow: var(--glow-c); }
  .nav-link:hover::after { width: 100%; }

  /* Hamburger button — hidden on desktop, shown on mobile */
  .hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }

  .hamburger span {
    display: block;
    width: 24px;
    height: 2px;
    background: var(--cyan);
    transition: all 0.3s;
  }

  /* X animation when mobile nav is open */
  .hamburger span.rot45    { transform: rotate(45deg) translate(5px, 5px);    }
  .hamburger span.hidden   { opacity: 0;                                       }
  .hamburger span.rotneg45 { transform: rotate(-45deg) translate(5px, -5px);  }

  /* Mobile dropdown menu */
  .mobile-menu {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: rgba(2, 4, 10, 0.98);
    backdrop-filter: blur(20px);
    padding: 2rem;
    border-bottom: 1px solid rgba(0, 245, 255, 0.12);
  }

  .mobile-link {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.85rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #a8b8d8;
    text-decoration: none;
    transition: color 0.3s;
  }

  .mobile-link:hover { color: var(--cyan); }

  /* Mobile breakpoint — swap links for hamburger */
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .hamburger { display: flex; }
    /* On mobile, hide the status label — keep only the dot to save space */
    .status-label { display: none; }
  }
</style>