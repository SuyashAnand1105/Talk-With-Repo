import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'
import MagicParticles from './MagicParticles'

const msgVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 10, filter: 'blur(4px)' },
  show:   { opacity: 1, scale: 1,    y: 0,  filter: 'blur(0px)',
             transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
}

export default function ChatWindow({ messages, querying, isActive, indexedPath, sendMessage, EXAMPLES }) {
  const [input, setInput] = useState('')
  const chatEndRef        = useRef(null)
  const textareaRef       = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, querying])

  const handleSend = useCallback(() => {
    const q = input.trim()
    if (!q || querying) return
    sendMessage(q)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }, [input, querying, sendMessage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  const handleChipClick = useCallback((ex) => {
    const q = ex.replace(/^💬 "|"$/g, '').replace(/^💬 /, '').replace(/^"|"$/g, '')
    sendMessage(q)
  }, [sendMessage])

  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  return (
    <>
      {/* ── Scrollable message area ────────────────────────────────────── */}
      <div className="chat-area">
        {/* Floating magic particles behind messages */}
        <MagicParticles count={40} opacity={0.35} />

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

          {!isActive ? (
            /* ── No repo loaded ── */
            <div className="welcome-state">
              <div className="welcome-portal">
                <span className="welcome-portal-core">🔮</span>
                <div className="welcome-portal-ring" />
                <div className="welcome-portal-ring2" />
              </div>
              <div className="welcome-title">Navigate Your Codebase with AI</div>
              <div className="welcome-sub">
                Enter your repository path in the sidebar, click{' '}
                <strong style={{ color: 'var(--gold-400)' }}>⚡ Index</strong>, then ask
                questions about architecture, dependencies, and logic.
              </div>
              <div className="example-chips">
                {(EXAMPLES ?? []).map((ex, i) => (
                  <motion.button
                    key={i}
                    className="example-chip"
                    onClick={() => handleChipClick(ex)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ x: 6 }}
                  >
                    {ex}
                  </motion.button>
                ))}
              </div>
            </div>

          ) : messages.length === 0 ? (
            /* ── Repo loaded, no messages ── */
            <div className="welcome-state">
              <div className="welcome-portal">
                <span className="welcome-portal-core">✨</span>
                <div className="welcome-portal-ring" />
                <div className="welcome-portal-ring2" />
              </div>
              <div className="welcome-title">Ready to Explore!</div>
              <div className="welcome-sub">
                Your codebase is indexed and loaded. Try one of these queries:
              </div>
              <div className="example-chips">
                {(EXAMPLES ?? []).map((ex, i) => (
                  <motion.button
                    key={i}
                    className="example-chip"
                    onClick={() => handleChipClick(ex)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ x: 6 }}
                  >
                    {ex}
                  </motion.button>
                ))}
              </div>
            </div>

          ) : (
            /* ── Message list ── */
            <>
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    variants={msgVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <MessageBubble
                      role={msg.role}
                      content={msg.content}
                      sources={msg.sources}
                      indexedPath={indexedPath}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* ── Orbital thinking indicator ── */}
              <AnimatePresence>
                {querying && (
                  <motion.div
                    key="thinking"
                    className="thinking-row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="msg-avatar avatar-assistant">🔮</div>
                    <div className="thinking-orbital">
                      <div className="orbital-center" />
                      <div className="orbital-planet" />
                      <div className="orbital-planet" />
                      <div className="orbital-planet" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Arcane input bar ──────────────────────────────────────────── */}
      <motion.div
        className="chat-input-bar"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            id="chat-input"
            className="chat-textarea"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isActive
                ? 'Ask anything about the codebase… (Enter to send, Shift+Enter for newline)'
                : 'Index a repository to start asking questions…'
            }
            rows={1}
            disabled={!isActive || querying}
          />
          <motion.button
            id="send-btn"
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || !isActive || querying}
            title="Send (Enter)"
            whileHover={{ scale: 1.12, rotate: 8 }}
            whileTap={{ scale: 0.9 }}
          >
            ✦
          </motion.button>
        </div>
      </motion.div>
    </>
  )
}
