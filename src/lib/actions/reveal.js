// ═══════════════════════════════════════════════════════════════════
// src/lib/actions/reveal.js — Scroll Reveal Action
// ═══════════════════════════════════════════════════════════════════
// WHAT IS A SVELTE ACTION?
// An action is a reusable function that gets direct access to a DOM
// element. Applied with the use: directive on any HTML element.
//
// Svelte vs React comparison:
//   React:  const ref = useRef()
//           useEffect(() => {
//             const observer = new IntersectionObserver(...)
//             observer.observe(ref.current)
//             return () => observer.disconnect()
//           }, [])
//           <div ref={ref}>...</div>
//
//   Svelte: <div use:reveal={{ delay: 200 }}>...</div>
//           ← that's it. action handles setup + cleanup automatically.
//
// USAGE:
//   import { reveal } from '$lib/actions/reveal.js'
//
//   <section use:reveal>...</section>
//   <div use:reveal={{ delay: 100 }}>...</div>
//   <div use:reveal={{ delay: 200, threshold: 0.2 }}>...</div>
//
// HOW IT WORKS:
//   1. Element starts hidden (opacity:0, shifted down 28px)
//   2. IntersectionObserver watches for element entering viewport
//   3. When visible → animate to opacity:1 and original position
//   4. Observer disconnects after firing (only animates once)
//   5. On element removal → destroy() cleans up the observer
// ═══════════════════════════════════════════════════════════════════

/**
 * Reveal action — fades and slides element in when it enters viewport.
 *
 * @param {HTMLElement} node       - The DOM element (injected by Svelte)
 * @param {object}      options    - Optional configuration
 * @param {number}      options.delay     - Animation delay in ms (default: 0)
 *                                          Use to stagger multiple elements:
 *                                          delay:0, delay:100, delay:200...
 * @param {number}      options.threshold - How much of element must be visible
 *                                          before triggering (default: 0.12 = 12%)
 *                                          0 = trigger as soon as 1px is visible
 *                                          1 = trigger only when fully visible
 */
export function reveal(node, { delay = 0, threshold = 0.12 } = {}) {

  // ── Initial Hidden State ─────────────────────────────────────────
  // Set before the element renders — prevents flash of visible content.
  // translateY(28px) = start 28px below final position (slides up on reveal).
  node.style.opacity   = '0';
  node.style.transform = 'translateY(28px)';

  // CSS transition — what animates and how.
  // Both opacity and transform animate together over 0.7s with ease curve.
  // delay is applied to BOTH so they stay in sync.
  node.style.transition = `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`;

  // ── IntersectionObserver ─────────────────────────────────────────
  // Browser-native API that fires when an element enters/exits viewport.
  // Much more performant than scroll event listeners.
  //
  // ([entry]) destructures the entries array — we only observe one element
  // per observer instance so entries always has exactly one item.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        // Element is visible — trigger the reveal animation
        node.style.opacity   = '1';
        node.style.transform = 'none';

        // Disconnect immediately — we only want to animate once.
        // Without this, scrolling back up and down would re-trigger.
        observer.disconnect();
      }
    },
    {
      threshold,
      // rootMargin: negative bottom margin means the trigger fires
      // when element is 40px INTO the viewport, not right at the edge.
      // Prevents elements at the very bottom edge from triggering too early.
      rootMargin: '0px 0px -40px 0px'
    }
  );

  observer.observe(node);

  // ── Cleanup ──────────────────────────────────────────────────────
  // destroy() is called automatically by Svelte when the element is
  // removed from the DOM (component unmounts, {#if} becomes false etc.)
  // Equivalent to the return function inside React's useEffect.
  // Prevents memory leaks from orphaned observers.
  return {
    destroy() {
      observer.disconnect();
    }
  };
}