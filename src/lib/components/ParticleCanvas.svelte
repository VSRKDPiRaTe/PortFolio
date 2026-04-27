<script>
  // ── Imports ───────────────────────────────────────────────────────
  // onMount  → runs after component mounts to DOM, browser-only.
  //            Safe to access window/document/canvas here.
  //            React equivalent: useEffect(() => {}, [])
  //
  // onDestroy → runs before component is removed from DOM.
  //             Critical for canvas: MUST cancel the animation frame
  //             and remove event listeners to prevent memory leaks.
  //             React equivalent: return () => cleanup() in useEffect
  import { onMount, onDestroy } from 'svelte';

  // ── DOM Reference ─────────────────────────────────────────────────
  // bind:this={canvas} assigns the actual <canvas> DOM element here.
  // React equivalent: const canvas = useRef() → canvas.current
  // Must be declared before onMount — Svelte assigns it before
  // onMount fires so it is always available inside onMount().
  let canvas;

  // ── Canvas State ──────────────────────────────────────────────────
  let ctx;          // 2D rendering context — the drawing API
  let animFrame;    // requestAnimationFrame ID — needed to cancel on destroy
  let W, H;         // canvas width + height — updated on resize
  let particles = [];

  // ── Particle Count ────────────────────────────────────────────────
  // 120 particles on desktop, fewer on mobile for performance.
  // Canvas particle animation is CPU-intensive — O(n²) for connections.
  // Mobile devices have less GPU/CPU headroom so we reduce the count.
  // window.innerWidth check happens inside onMount (browser-only context).
  const PARTICLE_COUNT_DESKTOP = 120;
  const PARTICLE_COUNT_MOBILE  = 60;
  const CONNECTION_DISTANCE    = 100; // px — max distance to draw a line

  // ── Particle Class ────────────────────────────────────────────────
  // Each particle is a small dot that floats around the canvas.
  // reset() randomises position/velocity/appearance.
  // Called once on construction and again when particle exits canvas bounds.
  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      // Random position across full canvas
      this.x = Math.random() * W;
      this.y = Math.random() * H;

      // Slow random velocity — subtle drift effect
      // Range: -0.15 to +0.15 px per frame
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;

      // Random opacity — creates depth illusion (some particles feel closer)
      this.alpha = Math.random() * 0.5 + 0.05;

      // Random radius — mix of tiny dots and slightly larger ones
      this.r = Math.random() * 1.5 + 0.3;

      // Alternate between cyan and magenta — matches portfolio palette
      this.color = Math.random() > 0.5 ? '#00f5ff' : '#ff00c8';
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // If particle drifts off-screen, reset it to a random position.
      // This keeps the particle count constant without complex recycling.
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
        this.reset();
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle   = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.fill();
    }
  }

  // ── Resize Handler ────────────────────────────────────────────────
  // Canvas pixel dimensions must match the viewport exactly.
  // If canvas.width/height != viewport, drawing coordinates are wrong.
  // Called once on mount and whenever the window resizes.
  //
  // NOTE: typeof window check is NOT needed inside onMount —
  // onMount is browser-only so window always exists here.
  // The check is only needed in module-level code that runs during SSR.
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Connection Lines ──────────────────────────────────────────────
  // Draws lines between particles that are close to each other.
  // Creates the "network graph" visual effect.
  //
  // COMPLEXITY: O(n²) — every particle checked against every other.
  // With 120 particles: 120×119/2 = 7,140 distance calculations per frame.
  // This is why we reduce particle count on mobile — fewer particles
  // means dramatically fewer calculations (60² vs 120² = 4x less work).
  //
  // Opacity fades linearly based on distance —
  // close particles have stronger lines, distant ones are nearly invisible.
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = '#00f5ff';
          // Alpha: 0.06 when touching, 0 at max distance
          // (1 - dist/max) * 0.06 = linear falloff
          ctx.globalAlpha = (1 - dist / CONNECTION_DISTANCE) * 0.06;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  // ── Animation Loop ────────────────────────────────────────────────
  // requestAnimationFrame is the browser-native animation API.
  // It fires ~60 times per second synced to the display refresh rate.
  // Much more efficient than setInterval for animation — browser can
  // throttle/pause it when the tab is hidden, saving battery/CPU.
  //
  // Each frame:
  //   1. Clear the entire canvas
  //   2. Update + draw each particle
  //   3. Draw connection lines between nearby particles
  //   4. Reset globalAlpha (particles modify it — must reset for next frame)
  //   5. Schedule next frame
  function animate() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    drawConnections();

    // CRITICAL: reset globalAlpha after draw operations.
    // Particles set ctx.globalAlpha to their own alpha value.
    // Without resetting to 1, subsequent draws accumulate alpha changes
    // and the canvas goes completely transparent over time.
    ctx.globalAlpha = 1;

    animFrame = requestAnimationFrame(animate);
  }

  // ── Lifecycle: Mount ──────────────────────────────────────────────
  // onMount fires once after component renders to DOM.
  // canvas element exists and is bound via bind:this at this point.
  onMount(() => {
    // Get the 2D drawing context — all canvas drawing goes through this
    ctx = canvas.getContext('2d');

    // Set canvas dimensions to match viewport
    resize();

    // Fewer particles on narrow screens (mobile/tablet)
    const count = window.innerWidth < 768
      ? PARTICLE_COUNT_MOBILE
      : PARTICLE_COUNT_DESKTOP;

    // Initialise all particles — each randomises its own position
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    // Start the animation loop
    animate();

    // Update canvas size when browser window resizes
    window.addEventListener('resize', resize);
  });

  // ── Lifecycle: Destroy ────────────────────────────────────────────
  // onDestroy fires before component is removed from DOM.
  // ALWAYS cancel requestAnimationFrame on destroy — if not cancelled,
  // the animation loop continues running indefinitely in the background
  // even after the component is gone, leaking CPU and memory.
  onDestroy(() => {
    if (animFrame) cancelAnimationFrame(animFrame);
    window.removeEventListener('resize', resize);
  });
</script>


<!--
  position: fixed inset-0 = covers full viewport, always.
  z-index: 0             = behind all page content.
  pointer-events: none   = clicks pass through to elements below.
  The canvas sits behind everything — purely decorative.
-->
<canvas
  bind:this={canvas}
  class="fixed inset-0 z-0 pointer-events-none"
></canvas>