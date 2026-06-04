import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MessageBubble from './MessageBubble'

/**
 * ChatWindow — scrollable message area + chat input bar.
 */
export default function ChatWindow({ messages, querying, isActive, indexedPath, sendMessage, EXAMPLES }) {
  const [input, setInput]       = useState('')
  const chatEndRef              = useRef(null)
  const textareaRef             = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, querying])

  const handleSend = useCallback(() => {
    const q = input.trim()
    if (!q || querying) return
    sendMessage(q)
    setInput('')
    textareaRef.current?.focus()
  }, [input, querying, sendMessage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleChipClick = useCallback((example) => {
    const q = example.replace(/^💬 "|"$/g, '').replace(/^💬 /, '')
    sendMessage(q)
  }, [sendMessage])

  // Auto-resize textarea
  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px'
  }

  return (
    <>
      {/* ── Message area ──────────────────────────────────────────────── */}
      <div className="chat-area">
        {!isActive ? (
          /* Welcome / no repo loaded */
          <div className="welcome-state">
            <span className="welcome-icon">🧭</span>
            <div className="welcome-title">Navigate Any Codebase with AI</div>
            <div className="welcome-sub">
              Enter your repository path in the sidebar, click{' '}
              <strong style={{ color: 'var(--blue-400)' }}>Index</strong>, then start asking
              questions about architecture, dependencies, and logic.
            </div>
            <div className="example-chips">
              {(EXAMPLES ?? []).map((ex, i) => (
                <button
                  key={i}
                  className="example-chip"
                  onClick={() => handleChipClick(ex)}
                  title="Click to send"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* Repo loaded, no messages yet */
          <div className="welcome-state">
            <span className="welcome-icon">💡</span>
            <div className="welcome-title">Ready to explore!</div>
            <div className="welcome-sub">
              Your codebase is indexed and loaded. Try one of these:
            </div>
            <div className="example-chips">
              {(EXAMPLES ?? []).map((ex, i) => (
                <button
                  key={i}
                  className="example-chip"
                  onClick={() => handleChipClick(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
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

            {/* Thinking indicator */}
            <AnimatePresence>
              {querying && (
                <motion.div
                  key="thinking"
                  className="thinking-row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="msg-avatar avatar-assistant">🤖</div>
                  <div className="thinking-dots">
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────────────── */}
      <div className="chat-input-bar">
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
          <button
            id="send-btn"
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || !isActive || querying}
            title="Send (Enter)"
          >
            ➤
          </button>
        </div>
      </div>
    </>
  )
}
