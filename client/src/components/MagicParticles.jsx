import { useEffect, useRef } from 'react'

/**
 * MagicParticles — subtle floating stars / arcane sparks.
 * Renders on a canvas absolutely positioned behind the chat area.
 */
export default function MagicParticles({ count = 55, opacity = 0.55 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const COLORS = [
      [251, 191, 36],   // gold
      [192, 132, 252],  // purple
      [45,  212, 191],  // teal
      [253, 230, 138],  // light gold
    ]

    let W, H, particles, rafId

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
    }

    const mkParticle = () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    0.5 + Math.random() * 1.8,
      vx:   (Math.random() - 0.5) * 0.22,
      vy:   (Math.random() - 0.5) * 0.22,
      col:  COLORS[Math.floor(Math.random() * COLORS.length)],
      a:    0.1 + Math.random() * 0.55,
      da:   (Math.random() - 0.5) * 0.004,  // twinkle
      life: Math.random() * Math.PI * 2,    // phase offset
    })

    const init = () => {
      resize()
      particles = Array.from({ length: count }, mkParticle)
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const t = performance.now() / 1000

      for (const p of particles) {
        p.life += 0.015
        const twinkle = 0.5 + 0.5 * Math.sin(p.life)
        const alpha   = p.a * twinkle * opacity

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${alpha})`
        ctx.fill()

        // Soft glow halo on larger particles
        if (p.r > 1.3) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
          g.addColorStop(0, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${alpha * 0.5})`)
          g.addColorStop(1, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},0)`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }

        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        if (p.y < -10) p.y = H + 10
        if (p.y > H + 10) p.y = -10
      }

      rafId = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    init()
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [count, opacity])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  )
}
