import { useEffect, useRef } from 'react'

// Code-like characters for the rain effect
const CHARS =
  '{}[];()<>=+-*/&|!%^~?:.,@#\\01abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const KEYWORDS = [
  'const', 'let', 'var', 'def', 'fn', 'for', 'if', 'else',
  'return', 'class', 'import', 'export', 'async', 'await',
  'try', 'catch', 'int', 'void', 'pub', 'true', 'false',
]

/**
 * Canvas-based code rain animation — Matrix style but with code syntax chars.
 * Blue/cyan color palette to match the app theme.
 */
export default function CodeRain({ opacity = 0.14 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const FONT_SIZE = 14
    const SPEED_VARIANCE = 0.6 // columns move at different speeds

    let cols, drops, speeds, colors
    let animId

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      cols   = Math.floor(canvas.width / FONT_SIZE)
      drops  = Array.from({ length: cols }, () => Math.random() * -canvas.height)
      speeds = Array.from({ length: cols }, () => 0.4 + Math.random() * SPEED_VARIANCE)
      colors = Array.from({ length: cols }, () => Math.random())
    }

    resize()

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    function draw() {
      // Subtle trail fade
      ctx.fillStyle = 'rgba(5, 11, 20, 0.055)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`

      for (let i = 0; i < cols; i++) {
        // Occasionally output a full keyword
        const useKeyword = Math.random() < 0.015
        const char = useKeyword
          ? KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)]
          : CHARS[Math.floor(Math.random() * CHARS.length)]

        const y   = drops[i] * FONT_SIZE
        const x   = i * FONT_SIZE

        // Lead char is bright, rest is dim
        const isLead = drops[i] % 1 < 0.1
        const alpha  = isLead ? 0.95 : 0.25 + Math.random() * 0.35

        // Colour varies by column seed: gold, purple, or teal
        if (colors[i] < 0.45) {
          ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`    // gold-400
        } else if (colors[i] < 0.75) {
          ctx.fillStyle = `rgba(192, 132, 252, ${alpha})`   // purple-400
        } else {
          ctx.fillStyle = `rgba(45, 212, 191, ${alpha})`    // teal-400
        }

        ctx.fillText(char, x, y)

        // Reset column when it goes off-screen
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i]  = 0
          speeds[i] = 0.4 + Math.random() * SPEED_VARIANCE
          colors[i] = Math.random()
        }

        drops[i] += speeds[i]
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
