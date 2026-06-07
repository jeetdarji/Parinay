// Reusable Lenis helpers. One global window instance + a scoped-element hook.
import { useEffect } from 'react'
import Lenis from '@studio-freight/lenis'

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

/**
 * Global window-level smooth scroll. Call once at the app root.
 * Respects prefers-reduced-motion (skips entirely).
 */
export function useGlobalLenis() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: easeOutCubic,
      smoothWheel: true,
    })
    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    
    // Store globally so modals can pause background scrolling
    window.lenis = lenis

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      window.lenis = null
    }
  }, [])
}

/**
 * Scoped Lenis for an overflow container.
 * @param {React.RefObject} ref  the scroll container element
 * @param {object} opts          { duration, orientation, enabled }
 */
export function useScopedLenis(ref, opts = {}) {
  const { duration = 0.9, orientation = 'vertical', enabled = true } = opts

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768) return

    const lenis = new Lenis({
      wrapper: el,
      content: el,
      duration,
      orientation,
      gestureOrientation: orientation === 'horizontal' ? 'both' : 'vertical',
      easing: easeOutCubic,
      smoothWheel: true,
    })
    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [ref, duration, orientation, enabled])
}
