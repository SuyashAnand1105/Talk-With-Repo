import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DEFAULT_LLM       = import.meta.env.VITE_LLM_MODEL   || 'nova-micro (from .env)'
const DEFAULT_EMBED     = import.meta.env.VITE_EMBED_MODEL  || 'text-embedding-3-small'
const DEFAULT_ENDPOINT  = 'from .env / api.openai.com'

/**
 * Sidebar component — repo input, stats, indexing controls, and provider settings.
 */
export default function Sidebar({
  // Repo
  repoPath, setRepoPath,
  scanSummary, indexExists, isActive,
  // Actions
  indexRepo, loadRepo, clearChat,
  // Flags
  indexing, loading, indexProgress, error, setError,
  // Settings
  baseUrl, setBaseUrl,
  llmModel, setLlmModel,
  embeddingModel, setEmbeddingModel,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cleanPath = repoPath.trim().replace(/^["']|["']$/g, '')
  const hasPath   = Boolean(cleanPath)
  const hasError  = scanSummary?.error

  // Status badge
  let badge = null
  if (isActive) {
    badge = <span className="badge badge-success">✓ Indexed &amp; Active</span>
  } else if (indexExists && hasPath && !hasError) {
    badge = <span className="badge badge-info">💾 Index on disk</span>
  } else if (hasPath && !hasError && scanSummary) {
    badge = <span className="badge badge-warning">⏳ Not indexed</span>
  }

  return (
    <aside className="sidebar">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-emoji">🔭</span>
          <div>
            <div className="sidebar-logo-name">Talk-With-Repo</div>
            <div className="sidebar-logo-sub">AI Codebase Navigator</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="sidebar-scroll">

        {/* Repo path */}
        <div className="field">
          <label className="field-label section-title">📁 Repository Path</label>
          <input
            id="repo-path-input"
            className="input"
            value={repoPath}
            onChange={e => setRepoPath(e.target.value)}
            placeholder="e.g.  C:/Projects/my-app"
            spellCheck={false}
          />
        </div>

        {/* Scan stats */}
        <AnimatePresence>
          {scanSummary && !scanSummary.error && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-value">{scanSummary.total}</div>
                  <div className="stat-label">files</div>
                </div>
                {Object.entries(scanSummary.by_extension ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([ext, cnt]) => (
                    <div key={ext} className="stat-card">
                      <div className="stat-value">{cnt}</div>
                      <div className="stat-label">{ext}</div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error on path */}
        {hasPath && hasError && (
          <div className="error-banner">⚠ {scanSummary.error}</div>
        )}

        {/* Status badge */}
        {badge && <div>{badge}</div>}

        <div className="divider" />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <motion.button
            id="btn-index"
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            disabled={!hasPath || !!hasError || indexing || loading}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={indexRepo}
          >
            {indexing ? (
              <><span className="anim-spin" style={{ display:'inline-block' }}>⟳</span> Indexing…</>
            ) : '⚡ Index'}
          </motion.button>

          <motion.button
            id="btn-load"
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            disabled={!indexExists || isActive || loading || indexing}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={loadRepo}
          >
            {loading ? (
              <><span className="anim-spin" style={{ display:'inline-block' }}>⟳</span> Loading…</>
            ) : '📂 Load'}
          </motion.button>
        </div>

        {/* Indexing progress log */}
        <AnimatePresence>
          {indexing && indexProgress.length > 0 && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="progress-log">
                {indexProgress.map((line, i) => (
                  <span key={i} className="progress-line">{line}</span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="error-banner"
            >
              <span>⚠</span>
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}
              >×</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="divider" />

        {/* Provider settings (collapsible) */}
        <div>
          <div
            id="settings-toggle"
            className="collapsible-header section-title"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setSettingsOpen(o => !o)}
          >
            <span>⚙️ Provider Settings</span>
            <span className={`chevron ${settingsOpen ? 'open' : ''}`}>▼</span>
          </div>

          <div className={`collapsible-body ${settingsOpen ? 'open' : 'closed'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.65rem' }}>
              <div className="field">
                <label className="field-label">Base URL</label>
                <input
                  id="input-base-url"
                  className="input"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="field">
                <label className="field-label">Chat model</label>
                <input
                  id="input-llm-model"
                  className="input"
                  value={llmModel}
                  onChange={e => setLlmModel(e.target.value)}
                  placeholder={DEFAULT_LLM}
                />
              </div>
              <div className="field">
                <label className="field-label">Embedding model</label>
                <input
                  id="input-embed-model"
                  className="input"
                  value={embeddingModel}
                  onChange={e => setEmbeddingModel(e.target.value)}
                  placeholder={DEFAULT_EMBED}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Clear chat */}
        <motion.button
          id="btn-clear-chat"
          className="btn btn-danger btn-sm btn-block"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={clearChat}
        >
          🗑️ Clear Conversation
        </motion.button>

      </div>{/* end sidebar-scroll */}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-info">
          <b>LLM:</b> <span>{llmModel || DEFAULT_LLM}</span><br />
          <b>Embed:</b> <span>{embeddingModel || DEFAULT_EMBED}</span><br />
          <b>Endpoint:</b> <span>{baseUrl || DEFAULT_ENDPOINT}</span><br />
          <b>Store:</b> <span>ChromaDB (local)</span>
        </div>
      </div>
    </aside>
  )
}
