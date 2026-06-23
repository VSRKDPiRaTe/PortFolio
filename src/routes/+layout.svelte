<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  src/routes/+layout.svelte — Root Layout (All Routes)           ║
  ╚═══════════════════════════════════════════════════════════════════╝

  WHAT THIS FILE IS:
    The absolute root layout — wraps EVERY route in the application.
    This includes both:
      - (site)     → public portfolio pages
      - (ownerapp) → owner authentication and management interface

  WHAT IT DOES:
    1. Injects Vercel Speed Insights for performance monitoring
    2. Renders child layouts and pages via {@render children()}

  WHY THIS EXISTS:
    Route groups like (site) and (ownerapp) create separate layout trees,
    but both need Speed Insights. Creating this root layout ensures the
    analytics are active across the entire application without duplicating
    the injection code.
-->

<script>
  import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

  let { children } = $props();

  // Inject Vercel Speed Insights for performance monitoring
  injectSpeedInsights();
</script>

{@render children()}
