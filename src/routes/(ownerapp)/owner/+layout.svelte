<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  src/routes/owner/+layout.svelte — Owner Interface Shell         ║
  ╚═══════════════════════════════════════════════════════════════════╝

  Wraps every /owner/* page.
  Only renders after +layout.server.js confirms auth.

  LAYOUT:
    Desktop (>768px) → fixed left sidebar + scrollable main content
    Mobile  (<768px) → top navigation bar (hamburger hidden, links inline)
                       sidebar collapses — nav shows as a horizontal bar

  MOBILE STRATEGY:
    The sidebar becomes a horizontal top bar on mobile.
    Nav links shrink to icon-only to save space.
    Footer links (VIEW SITE, LOGOUT) move to the right of the top bar.
    Main content takes full width below the bar.
-->
<script>
  import '../../../app.css';
  import { page } from '$app/stores';
  import { logoutOwner } from '$lib/ownerapp/api/client.js';

  let { children } = $props();

  const navLinks = [
    { href: '/owner',            label: 'DASHBOARD',  icon: '⬡' },
    { href: '/owner/experience', label: 'EXPERIENCE', icon: '◈' },
    { href: '/owner/skills',     label: 'SKILLS',     icon: '◇' },
    { href: '/owner/projects',   label: 'PROJECTS',   icon: '◉' },
  ];

  // Logout — POST to the auth endpoint which clears the cookie
  async function logout() {
    await logoutOwner();
  }
</script>


<div class="owner-shell">

  <!-- ── Sidebar (desktop) / Top bar (mobile) ─────────────────────
    On desktop: fixed left column, full height, sticky.
    On mobile:  horizontal bar across the top, nav links in a row.
  ──────────────────────────────────────────────────────────────── -->
  <aside class="sidebar">

    <!-- Logo — hidden on mobile to save space, nav icons carry identity -->
    <div class="sidebar-logo">
      <span class="neon-c">PORTFOLIO</span>
      <span class="logo-sub">OWNER INTERFACE</span>
    </div>

    <!-- Nav links — vertical on desktop, horizontal on mobile -->
    <nav class="sidebar-nav">
      {#each navLinks as link}
        <a
          href={link.href}
          class="nav-item"
          class:active={$page.url.pathname === link.href}
          title={link.label}
        >
          <!-- Icon always visible. Label hidden on mobile via CSS. -->
          <span class="nav-icon">{link.icon}</span>
          <span class="nav-label">{link.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Footer actions — VIEW SITE + LOGOUT -->
    <div class="sidebar-footer">
      <a href="/" target="_blank" class="footer-link" title="View live portfolio">
        VIEW SITE →
      </a>
      <button class="footer-link logout-btn" onclick={logout} title="Log out">
        LOGOUT
      </button>
    </div>

  </aside>


  <!-- ── Main Content ──────────────────────────────────────────────
    Takes all remaining width after the sidebar.
    On mobile: full width below the top bar.
  ──────────────────────────────────────────────────────────────── -->
  <main class="owner-main">
    {@render children()}
  </main>

</div>


<style>
  /* ── Shell container ─────────────────────────────────────────────
     Flex row on desktop (sidebar | main).
     Flex column on mobile (topbar / main). */
  .owner-shell {
    display: flex;
    min-height: 100vh;
    background: #02040a;
    font-family: 'Share Tech Mono', monospace;
    color: #a8b8d8;
  }


  /* ── Sidebar — desktop ───────────────────────────────────────────
     Fixed left column, 220px wide, full viewport height.
     Sticky so it stays in place while main content scrolls. */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid rgba(0,245,255,0.1);
    display: flex;
    flex-direction: column;
    padding: 1.5rem 0;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .sidebar-logo {
    padding: 0 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    font-family: 'Orbitron', monospace;
    font-weight: 900;
    font-size: 0.9rem;
    letter-spacing: 0.06em;
  }

  .logo-sub {
    display: block;
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    color: rgba(168,184,216,0.35);
    margin-top: 0.3rem;
    font-family: 'Share Tech Mono', monospace;
    font-weight: 400;
  }

  /* Vertical nav on desktop */
  .sidebar-nav {
    flex: 1;
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 1.25rem;
    text-decoration: none;
    color: rgba(168,184,216,0.6);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    border-left: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .nav-item:hover  { color: var(--cyan); background: rgba(0,245,255,0.03); }

  .nav-item.active {
    color: var(--cyan);
    border-left-color: var(--cyan);
    background: rgba(0,245,255,0.05);
    text-shadow: var(--glow-c);
  }

  .nav-icon  { font-size: 0.85rem; flex-shrink: 0; }
  .nav-label { letter-spacing: 0.14em; }

  /* Footer links at bottom of sidebar */
  .sidebar-footer {
    padding: 1rem 1.25rem 0;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .footer-link {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    color: rgba(168,184,216,0.4);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
    font-family: inherit;
    transition: color 0.2s;
  }

  .footer-link:hover { color: var(--cyan);     }
  .logout-btn:hover  { color: var(--magenta);  }


  /* ── Main content ────────────────────────────────────────────────
     Fills remaining width. Padded for readability. */
  .owner-main {
    flex: 1;
    padding: 2rem 2.5rem;
    overflow-y: auto;
    max-width: 1100px;
    min-width: 0; /* prevents flex overflow on narrow screens */
  }


  /* ── Mobile — max-width: 768px ───────────────────────────────────
     Sidebar becomes a horizontal top bar.
     Logo hidden — too wide for mobile bar.
     Nav links become icon-only row (label hidden, title attr for tooltip).
     Footer links move inline to the right of the nav.
     Main content full width below the bar. */
  @media (max-width: 768px) {
    .owner-shell {
      flex-direction: column; /* stack topbar above main */
    }

    .sidebar {
      width: 100%;         /* full width across the top */
      height: auto;        /* shrink to content height */
      position: sticky;
      top: 0;
      z-index: 50;
      flex-direction: row; /* logo | nav | footer in a row */
      align-items: center;
      padding: 0.6rem 1rem;
      border-right: none;
      border-bottom: 1px solid rgba(0,245,255,0.12);
      background: rgba(2,4,10,0.96);
      backdrop-filter: blur(12px);
      gap: 0.5rem;
      overflow-y: visible;
      overflow-x: auto;
    }

    /* Hide logo on mobile — not enough space */
    .sidebar-logo { display: none; }

    /* Nav becomes a horizontal row of icon-only links */
    .sidebar-nav {
      flex-direction: row;
      padding: 0;
      gap: 0.15rem;
      flex: 1;
    }

    .nav-item {
      padding: 0.5rem 0.65rem;
      border-left: none;
      border-bottom: 2px solid transparent;
      gap: 0;
      flex-direction: column;
      align-items: center;
      font-size: 0.6rem;
    }

    .nav-item.active {
      border-left-color: transparent;
      border-bottom-color: var(--cyan);
    }

    /* Hide text labels on mobile — icons only */
    .nav-label { display: none; }

    .nav-icon { font-size: 1rem; }

    /* Footer links inline to the right */
    .sidebar-footer {
      flex-direction: row;
      border-top: none;
      border-left: 1px solid rgba(255,255,255,0.06);
      padding: 0 0 0 0.75rem;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    /* Main content full width, less padding on mobile */
    .owner-main {
      padding: 1.25rem 1rem;
    }
  }


  /* ── Very small screens — max-width: 480px ───────────────────────
     Reduce padding further, keep everything usable. */
  @media (max-width: 480px) {
    .sidebar     { padding: 0.5rem 0.75rem; }
    .owner-main  { padding: 1rem 0.75rem; }
    .footer-link { font-size: 0.58rem; }
  }
</style>