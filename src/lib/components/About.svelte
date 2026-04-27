<script>
  // ── Imports ──────────────────────────────────────────────────────
  import { getContext } from "svelte";
  import { reveal } from "$lib/actions/reveal.js";
  import {
    SITE_FULL_NAME,
    SITE_ROLE_PRIMARY,
    LOCATION,
    SITE_TAGLINE,
    STATUS_CURRENT,
  } from "$lib/config.js";

  // ── Server Context ────────────────────────────────────────────────
  // getContext('site') reads data set by +layout.svelte via setContext.
  // That data comes from +layout.server.js — server-loaded from env vars.
  // site.links.github, site.links.linkedin, site.links.email are
  // constructed server-side so usernames never appear in client bundle.
  // site.githubProfile contains avatar, bio, followers from GitHub API.
  //
  // React equivalent: const site = useContext(SiteContext)
  const site = getContext("site");

  // ── Email Handling ────────────────────────────────────────────────
  // Extract clean email string (removes accidental "mailto:" if present)
  const emailAddress = String(site?.links?.email ?? "")
    .replace(/^mailto:/i, "")
    .trim();

  // ── Copy Email State + Function ───────────────────────────────────
  // Handles clipboard copy with temporary UI feedback ("COPIED")
  let copiedEmail = false;

  async function copyEmail(email) {
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      copiedEmail = true;

      setTimeout(() => (copiedEmail = false), 1500);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  }

  // ── Social Links ──────────────────────────────────────────────────
  // Built from server context (site.links.*) so URLs come from env vars.
  // icon: raw SVG path data — rendered via {@html} in the template.
  // Using {@html} is safe here because this is our own static data,
  // not user-generated content.
  //
  // Svelte note: arrays and objects used only in the template
  // do not need $state() — only values that CHANGE need reactivity.
  // This array is defined once and never mutated, so plain const is fine.
  const socialLinks = [
    {
      href: site?.links?.github ?? "#",
      label: "GITHUB",
      icon: '<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>',
    },
    {
      href: site?.links?.linkedin ?? "#",
      label: "LINKEDIN",
      icon: '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
    },
    // {
    //   href:  '/resume.pdf',
    //   label: 'RESUME',
    //   icon:  '<path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>',
    // },
  ];

  const externalIcon = `<svg viewBox="0 0 16 16" width="11" fill="currentColor"><path d="M2 2h5v2H4v8h8V9h2v5H2V2zm7 0h5v5h-2V4.414L7.707 9.707 6.293 8.293 11.586 3H9V1z"/></svg>`;
</script>

<!--
  About section — two column layout:
    Left:  Terminal window (whoami.exe) — shows profile as JSON
    Right: Bio text + social link buttons

  use:reveal on each element triggers the scroll-reveal action from
  $lib/actions/reveal.js — fades + slides element in when it enters
  the viewport. delay staggered so elements appear one after another.

  All personal data comes from config.js or site context — zero
  hardcoded strings in this template.
-->
<section id="about" class="section-pad bg-linear-to-b from-bg to-bg2">
  <div class="max-w-6xl mx-auto px-8">
    <div class="grid md:grid-cols-2 gap-16 lg:gap-24 items-start">
      <!-- ── Terminal Window ────────────────────────────────────────
        Styled to look like a real terminal — macOS-style traffic light
        dots in the header bar, monospace font, JSON-formatted content.
        animate: pulse-border makes the border gently glow on/off.
      ──────────────────────────────────────────────────────────── -->
      <div use:reveal class="terminal-window">
        <!-- Terminal title bar with traffic light dots -->
        <div
          class="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/10"
        >
          <!-- Red / Yellow / Green dots — decorative, not functional -->
          <span
            class="w-2.5 h-2.5 rounded-full bg-nred"
            style="box-shadow: 0 0 6px var(--red);"
          ></span>
          <span
            class="w-2.5 h-2.5 rounded-full bg-nyellow"
            style="box-shadow: 0 0 6px var(--yellow);"
          ></span>
          <span
            class="w-2.5 h-2.5 rounded-full bg-ngreen"
            style="box-shadow: 0 0 6px var(--green);"
          ></span>
          <span
            class="font-mono text-[0.68rem] text-text-dim mx-auto tracking-widest"
            >whoami.exe</span
          >
        </div>

        <!-- Terminal body — profile data as formatted JSON -->
        <div class="p-6 font-mono text-[0.82rem] leading-loose">
          <!-- Command prompt line: $ cat profile.json -->
          <div>
            <span class="text-ngreen">$</span>
            <span class="text-cyan"> cat profile.json</span>
          </div>
          <br />

          <!-- JSON object — all values from config.js and site context.
               {backtick}{`{`}{backtick} escapes the curly brace in Svelte template.
               Without escaping, Svelte would treat { as a template expression. -->
          <div class="text-text-dim">{`{`}</div>

          <!-- name from config.js SITE_FULL_NAME -->
          <div class="pl-5">
            <span class="text-magenta">"name"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">"{SITE_FULL_NAME}"</span>
            <span class="text-text-dim">,</span>
          </div>

          <!-- role from config.js SITE_ROLE_PRIMARY -->
          <div class="pl-5">
            <span class="text-magenta">"role"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">"{SITE_ROLE_PRIMARY}"</span>
            <span class="text-text-dim">,</span>
          </div>

          <!-- location from config.js LOCATION -->
          <div class="pl-5">
            <span class="text-magenta">"location"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">"{LOCATION}"</span>
            <span class="text-text-dim">,</span>
          </div>

          <!-- terminal status line -->
          <div class="pl-5">
            <span class="text-magenta">"status"</span>
            <span class="text-text-dim">: </span>

            <span
              class="inline-block w-1.5 h-1.5 rounded-full mr-1 {STATUS_CURRENT.color}"
              class:animate-blink={STATUS_CURRENT.pulse}
              style="box-shadow: {STATUS_CURRENT.glow};"
            ></span>

            <span class={STATUS_CURRENT.color}>"{STATUS_CURRENT.label}"</span>
            <span class="text-text-dim">,</span>
          </div>

          <div class="pl-5">
            <span class="text-magenta">"fuel"</span>
            <span class="text-text-dim">: </span>
            <span class="neon-c">"hot_chocolate ∞"</span>
            <span class="text-text-dim">,</span>
          </div>

          <div class="pl-5">
            <span class="text-magenta">"mission"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">"build things that outlast trends"</span>
            <span class="text-text-dim">,</span>
          </div>

          <div class="pl-5">
            <span class="text-magenta">"uptime"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">
              "99.99% powered by stubbornness & late nights"
            </span>
            <span class="text-text-dim">,</span>
          </div>

          <div class="pl-5">
            <span class="text-magenta">"now_playing"</span>
            <span class="text-text-dim">: </span>

            <a
              href={site?.links?.spotify_playlist ?? "#"}
              target="_blank"
              rel="noreferrer"
              class="social-link inline-flex items-center gap-1 text-nyellow hover:opacity-90 transition"
            >
              "💥💥 WORKOUT"
              <span class="inline-block align-middle">
                {@html externalIcon}
              </span>
            </a>

            <span class="text-text-dim">,</span>
          </div>

          <div class="pl-5">
            <span class="text-magenta">"mood"</span>
            <span class="text-text-dim">: </span>
            <span class="text-nyellow">"locked_in"</span>
            <span class="text-text-dim">,</span>
          </div>
          <div class="text-text-dim">{`}`}</div>

          <br />
          <div>
            <span class="text-ngreen">$</span>
            <span class="opacity-50 italic"> system.initialized</span>
          </div>

          <!-- Blinking cursor — animate-blink from app.css @theme -->
          <div>
            <span class="text-ngreen">$</span>
            <span class="text-cyan"> _</span>
            <span
              class="animate-blink inline-block w-2 h-3.5 bg-ngreen align-text-bottom ml-0.5"
            ></span>
          </div>
        </div>
      </div>

      <!-- ── Bio Text + Social Links ────────────────────────────────
        use:reveal staggered with increasing delay values so elements
        animate in sequence as user scrolls to this section.
        delay: 0, 100, 150, 200, 250 = each appears 50-100ms after previous.
      ──────────────────────────────────────────────────────────── -->
      <div>
        <!-- Section eyebrow label — defined in app.css as .section-label -->
        <div use:reveal class="section-label">ABOUT.SYS</div>

        <!-- Section heading -->
        <h3
          use:reveal={{ delay: 100 }}
          class="font-display font-bold text-text-hi text-2xl mb-4"
        >
          I Build Things That Actually Matter.
        </h3>

        <!-- Bio paragraphs -->
        <p use:reveal={{ delay: 150 }} class="text-text-dim leading-loose mb-4">
          {SITE_TAGLINE}
        </p>

        <p use:reveal={{ delay: 200 }} class="text-text-dim leading-loose mb-8">
          Based in {LOCATION}. I specialise in full-stack engineering and data
          pipelines, building systems that scale, interfaces that feel alive,
          and code that is worth reading. When not shipping, deep in some
          open-source rabbit hole.
        </p>

        <!-- ── Social Links ──────────────────────────────────────────
          {#each} loops over socialLinks array — Svelte equivalent of .map().
          Each link renders as an angled button with SVG icon + label.

          link.href.startsWith('http') check:
            External links (GitHub, LinkedIn) get target="_blank" to open
            in new tab. Internal links (/resume.pdf, mailto:) do not.

          {@html link.icon}: renders raw SVG path inside the <svg> element.
            Safe here because link.icon is our own static data defined above,
            not user input. Never use {@html} with user-provided strings.

          clip-path: polygon() creates the angled button shape — same as
          .btn-angled in app.css but applied inline for precise control.
        ──────────────────────────────────────────────────────────── -->
        <div use:reveal={{ delay: 250 }} class="flex flex-wrap gap-3">
          {#each socialLinks as link}
            <a
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              class="social-link font-mono text-[0.7rem] tracking-widest uppercase text-text-dim no-underline px-4 py-2 border border-white/10 flex items-center gap-2 transition-all duration-300"
              style="clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);"
            >
              <svg viewBox="0 0 24 24" width="13" fill="currentColor"
                >{@html link.icon}</svg
              >
              {link.label}
            </a>
          {/each}

          <!-- ── COPY EMAIL BUTTON ──────────────────────────────────────────
              Replaces mailto link for reliability across all systems.
              Copies email to clipboard and shows temporary "COPIED" feedback.
          ──────────────────────────────────────────────────────────────── -->
          {#if emailAddress}
            <button
              type="button"
              on:click={() => copyEmail(emailAddress)}
              class="social-link font-mono text-[0.7rem] tracking-widest uppercase text-text-dim px-4 py-2 border border-white/10 flex items-center gap-2 transition-all duration-300 bg-transparent cursor-pointer"
              style="clip-path: polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%);"
            >
              <svg viewBox="0 0 24 24" width="13" fill="currentColor">
                <path
                  d="M16 1H4C2.9 1 2 1.9 2 3v12h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                />
              </svg>

              {copiedEmail ? "COPIED" : "EMAIL"}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  /* Section vertical padding — 100px top and bottom */
  .section-pad {
    padding: 100px 0;
  }

  /* Terminal window card — dark background with cyan border glow.
     animation: pulse-border defined in app.css @keyframes — gently
     brightens and dims the border creating a living terminal effect. */
  .terminal-window {
    background: rgba(6, 12, 26, 0.9);
    border: 1px solid rgba(0, 245, 255, 0.18);
    border-radius: 4px;
    box-shadow:
      0 0 40px rgba(0, 245, 255, 0.06),
      0 20px 60px rgba(0, 0, 0, 0.5);
    animation: pulse-border 4s ease-in-out infinite;
  }

  /* Social link hover state — cyan color + border + subtle background + glow.
     transition-all is set on the element via Tailwind class (duration-300). */
  .social-link:hover {
    color: var(--cyan);
    border-color: var(--cyan);
    background: rgba(0, 245, 255, 0.05);
    box-shadow: var(--glow-c);
  }
</style>
