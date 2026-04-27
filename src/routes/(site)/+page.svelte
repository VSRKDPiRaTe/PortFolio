<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  src/routes/+page.svelte — Homepage (route: /)                   ║
  ╚═══════════════════════════════════════════════════════════════════╝

  WHAT THIS FILE IS:
    This is the homepage of the portfolio — what loads at site.com/
    It is purely an orchestration file — it imports components and
    stacks them in order. No logic, no state, no styles live here.
    Every component owns its own markup, logic, and scoped CSS.

  SVELTEKIT ROUTING — how file names become URLs:
    src/routes/+page.svelte              → site.com/
    src/routes/projects/+page.svelte     → site.com/projects
    src/routes/projects/[slug]/+page.svelte → site.com/projects/securetrack

    The + prefix = SvelteKit framework file (not a component).
    The absence of a folder name = the root route (/).

  PAGE STRUCTURE:
    CRTWrapper wraps everything — it owns the boot animation system.
    Inside CRTWrapper:
      ParticleCanvas  → fixed background (animated dots + lines)
      Navbar          → fixed top navigation bar
      main            → scrollable page sections in order
      Footer          → site-wide footer

  DATA FLOW:
    +layout.server.js  → fetches GitHub data server-side (SSR — runs before browser loads)
    +layout.svelte     → receives server data, exposes via setContext('site')
    config.js          → static identity, SEO, dev flags, status display
                        (browser-safe only — no secrets, no API calls)
    +page.svelte       → reads context via getContext('site')
    Components         → import from config.js or read context directly as needed.

  WHY NO LOGIC HERE:
    Keeping this file as a pure list of components makes it easy to:
      - See the page structure at a glance
      - Reorder sections (just move the component tag)
      - Add/remove sections without touching logic
    All behaviour lives in the individual components.
-->

<script>
  // ── Svelte APIs ───────────────────────────────────────────────────
  // getContext reads data that +layout.svelte set via setContext('site').
  // That data was loaded server-side in +layout.server.js —
  // it contains GitHub links, profile data, and more.
  // React equivalent: const site = useContext(SiteContext)
  import { getContext } from 'svelte';

  // ── Config ────────────────────────────────────────────────────────
  // SEO contains all the metadata for this page:
  //   title, description, og:title, og:desc, og:url, twitterCard
  // All values come from config.js — never hardcoded in this file.
  // To update SEO: edit src/lib/config.js
  import { SEO } from '$lib/config.js';

  // ── Components ────────────────────────────────────────────────────
  // CRTWrapper  — owns the entire boot sequence + CRT open/close animation.
  //               Everything inside it is hidden until the boot completes.
  // ParticleCanvas — animated floating dots background (canvas element).
  // Navbar      — fixed top navigation with logo + links + status badge.
  // Hero        — full-screen intro: name, typewriter, stats, CTA.
  // About       — bio text + terminal window + social links.
  // Experience  — vertical timeline of work history.
  // Projects    — featured project cards pulled from GitHub + manual data.
  // Skills      — tabbed tech stack with animated skill bars.
  // Footer      — copyright, uptime, build info.
  import CRTWrapper     from '$lib/components/CRTWrapper.svelte';
  import Navbar         from '$lib/components/Navbar.svelte';
  import ParticleCanvas from '$lib/components/ParticleCanvas.svelte';
  import Hero           from '$lib/components/Hero.svelte';
  import About          from '$lib/components/About.svelte';
  import Experience     from '$lib/components/Experience.svelte';
  import Projects       from '$lib/components/Projects.svelte';
  import Skills         from '$lib/components/Skills.svelte';
  import Footer         from '$lib/components/Footer.svelte';

  // ── Server Context ────────────────────────────────────────────────
  // getContext('site') retrieves the object set in +layout.svelte.
  // Available fields:
  //   site.links.github    → your GitHub profile URL
  //   site.links.linkedin  → your LinkedIn profile URL
  //   site.links.email     → your contact email
  //   site.links.site      → your portfolio URL (for og:url)
  //   site.githubProfile   → avatar, bio, followers from GitHub API
  //   site.githubRepos     → all your repos (public + private)
  const site = getContext('site');
</script>


<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  SEO — <svelte:head>                                              ║
  ╚═══════════════════════════════════════════════════════════════════╝

  <svelte:head> injects its contents into the HTML <head> element.
  These tags override the base ones set in app.html.
  Svelte equivalent of Next.js <Head> or React Helmet — no library needed.

  TAG REFERENCE:
    <title>              → browser tab text + Google search headline
    og:title             → LinkedIn / Facebook / Discord share card title
    og:description       → share card description (keep under 200 chars)
    og:type              → "website" for portfolios (vs "article", "product")
    og:url               → canonical URL — tells Google your real domain
    og:image             → preview image shown in share cards
    og:image:width/height→ image dimensions (helps platforms render correctly)
    twitter:card         → "summary_large_image" = full banner image on Twitter/X
    twitter:title        → title shown in Twitter share card
    twitter:description  → description shown in Twitter share card
    twitter:image        → image shown in Twitter share card

  All values come from SEO object in config.js — never hardcoded here.
  og:image points to /og-image.png in the static/ folder.
  Image dimensions: 1500×800 — platforms scale to fit their card format.
-->
<svelte:head>
  <title>{SEO.title}</title>
  <meta name="description"         content={SEO.description} />

  <meta property="og:title"        content={SEO.ogTitle} />
  <meta property="og:description"  content={SEO.ogDesc} />
  <meta property="og:type"         content="website" />
  <meta property="og:url"          content={site.links.site} />
  <meta property="og:image"        content="{SEO.ogUrl}/og-image.png" />
  <meta property="og:image:width"  content="1500" />
  <meta property="og:image:height" content="800" />

  <meta name="twitter:card"        content={SEO.twitterCard} />
  <meta name="twitter:title"       content={SEO.ogTitle} />
  <meta name="twitter:description" content={SEO.ogDesc} />
  <meta name="twitter:image"       content="{SEO.ogUrl}/og-image.png" />
</svelte:head>


<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  Page Layout                                                      ║
  ╚═══════════════════════════════════════════════════════════════════╝

  CRTWrapper is the outermost wrapper for all visible content.
  It controls:
    1. BootScreen — the terminal boot sequence before portfolio shows
    2. CRT exit animation — boot screen collapses to a line, fades out
    3. CRT reveal animation — two panels slide apart, portfolio appears
  Until the boot sequence completes, nothing inside CRTWrapper is visible.

  SECTION ORDER (scroll from top to bottom):
    Hero        → first impression, name, roles, stats
    About       → story, personality, social links
    Experience  → proof — where you've worked and what you built
    Projects    → evidence — your actual work
    Skills      → depth — the full tech stack for those who want detail

  To reorder sections: move the component tags.
  To add a section: create the component, import it, add the tag.
  To remove a section: delete the tag (and optionally the navbar link).
-->
<CRTWrapper>

  <!-- ParticleCanvas: position:fixed z-index:0 — sits behind all content.
       Must be first in DOM so z-index stacking works correctly.
       Renders an animated particle network on a <canvas> element. -->
  <ParticleCanvas />

  <!-- Navbar: position:fixed top — always visible as user scrolls.
       Placed outside <main> because it is not page content. -->
  <Navbar />

  <!-- main: semantic HTML landmark — identifies primary page content.
       Screen readers and search engines use this to find the main body.
       Each child component has an id= attribute matching a Navbar link:
         Hero       id="hero"
         About      id="about"
         Experience id="experience"
         Projects   id="projects"
         Skills     id="skills"
       Navbar anchor links (#about, #experience etc.) scroll to these ids. -->
  <main>
    <Hero />
    <About />
    <Experience />
    <Projects />
    <Skills />
  </main>

  <!-- Footer: outside <main> — it is a site-wide element, not page content.
       Contains copyright, uptime clock, and build version. -->
  <Footer />

</CRTWrapper>