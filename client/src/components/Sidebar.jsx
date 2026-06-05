import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DEFAULT_LLM      = import.meta.env.VITE_LLM_MODEL  || 'nova-micro (from .env)'
const DEFAULT_EMBED    = import.meta.env.VITE_EMBED_MODEL || 'text-embedding-3-small'

/** RuneDivider — decorative gold separator */
const RuneDivider = () => (
  <div className="rune-divider">
    <span className="rune-divider-symbol">◈</span>
  </div>
)

/** ArcaneLabel — gold-styled section heading */
const ArcaneLabel = ({ children }) => (
  <div className="arcane-section-title">{children}</div>
)

export default function Sidebar({
  repoPath, setRepoPath,
  scanSummary, indexExists, isActive,
  indexRepo,
  clearChat,
  indexing, indexProgress, error, setError,
  baseUrl, setBaseUrl,
  llmModel, setLlmModel,
  embeddingModel, setEmbeddingModel,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cleanPath = repoPath.trim().replace(/^["']|["']$/g, '')
  const hasPath   = Boolean(cleanPath)
  const hasError  = scanSummary?.error

  let badge = null
  if (isActive) {
    badge = <span className="badge badge-success">✓ Indexed &amp; Active</span>
  } else if (indexExists && hasPath && !hasError) {
    badge = <span className="badge badge-info">◈ Index on Disk</span>
  } else if (hasPath && !hasError && scanSummary) {
    badge = <span className="badge badge-warning">⧡ Not Indexed</span>
  }

  return (
    <aside className="sidebar">

      {/* ── Grimoire Header ────────────────────────────────────────────── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-emoji">🔭</span>
          <div>
            <div className="sidebar-logo-name">Talk-With-Repo</div>
            <div className="sidebar-logo-sub">AI Codebase Navigator</div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Grimoire Body ───────────────────────────────────── */}
      <div className="sidebar-scroll">

        {/* Repository path */}
        <div className="arcane-field">
          <label className="arcane-label">Repository Path</label>
          <div className="arcane-input-wrap" style={{ display: 'flex', gap: '6px' }}>
            <input
              id="repo-path-input"
              className="arcane-input"
              style={{ flex: 1, minWidth: 0 }}
              value={repoPath}
              onChange={e => setRepoPath(e.target.value)}
              placeholder="e.g.  C:/Projects/my-app"
              spellCheck={false}
            />
            <button 
              className="btn btn-secondary btn-sm"
              style={{ padding: '0 10px', height: 'auto' }}
              onClick={async () => {
                try {
                  const res = await fetch('/api/repo/browse');
                  const data = await res.json();
                  if (data.path) setRepoPath(data.path);
                } catch (err) {
                  console.error('Browse failed:', err);
                }
              }}
              title="Browse for folder"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Scan stats */}
        <AnimatePresence>
          {scanSummary && !scanSummary.error && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28 }}
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

        {/* Path error */}
        {hasPath && hasError && (
          <div className="error-banner">⚠ {scanSummary.error}</div>
        )}

        {/* Status badge */}
        {badge && <div>{badge}</div>}

        <RuneDivider />

        {/* Action button — full width */}
        <motion.button
          id="btn-index"
          className="btn btn-primary btn-sm btn-block"
          disabled={!hasPath || !!hasError || indexing}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.94 }}
          onClick={indexRepo}
        >
          {indexing
            ? <><span className="anim-spin">⟳</span> Indexing…</>
            : isActive ? '⚡ Re-Index' : '⚡ Index'}
        </motion.button>

        {/* Indexing progress */}
        <AnimatePresence>
          {indexing && indexProgress.length > 0 && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 6 }}
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

        <RuneDivider />

        {/* Provider settings */}
        <div>
          <div
            id="settings-toggle"
            className="collapsible-header arcane-section-title"
            onClick={() => setSettingsOpen(o => !o)}
          >
            <span>⚙ Provider Settings</span>
            <span className={`chevron ${settingsOpen ? 'open' : ''}`}>▼</span>
          </div>

          <div className={`collapsible-body ${settingsOpen ? 'open' : 'closed'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingTop: '0.65rem' }}>

              <div className="arcane-field">
                <label className="arcane-label">Base URL</label>
                <div className="arcane-input-wrap">
                  <input
                    id="input-base-url"
                    className="arcane-input"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </div>

              <div className="arcane-field">
                <label className="arcane-label">Chat Model</label>
                <div className="arcane-input-wrap">
                  <input
                    id="input-llm-model"
                    className="arcane-input"
                    value={llmModel}
                    onChange={e => setLlmModel(e.target.value)}
                    placeholder={DEFAULT_LLM}
                  />
                </div>
              </div>

              <div className="arcane-field">
                <label className="arcane-label">Embedding Model</label>
                <div className="arcane-input-wrap">
                  <input
                    id="input-embed-model"
                    className="arcane-input"
                    value={embeddingModel}
                    onChange={e => setEmbeddingModel(e.target.value)}
                    placeholder={DEFAULT_EMBED}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        <RuneDivider />

        {/* Clear conversation */}
        <motion.button
          id="btn-clear-chat"
          className="btn btn-danger btn-sm btn-block"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={clearChat}
        >
          🗑 Clear Conversation
        </motion.button>

      </div>{/* end sidebar-scroll */}
    </aside>
  )
}
