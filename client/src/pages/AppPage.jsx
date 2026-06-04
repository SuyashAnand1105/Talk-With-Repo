import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import CodeRain from '../components/CodeRain'
import { useAppState } from '../hooks/useAppState'

export default function AppPage() {
  const navigate      = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth <= 768)

  // Sync mobile state on resize
  useState(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  const state = useAppState()

  const toggleSidebar = () => setSidebarOpen(o => !o)
  const closeSidebar  = () => isMobile && setSidebarOpen(false)

  return (
    <div className="app-layout">
      {/* Subtle code rain background */}
      <CodeRain opacity={0.045} />

      {/* Mobile overlay when sidebar is open */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            key="overlay"
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <div
        className={`sidebar ${isMobile ? (sidebarOpen ? 'mobile-open' : '') : (sidebarOpen ? '' : 'desktop-hidden')}`}
        style={{ position: isMobile ? 'fixed' : 'relative' }}
      >
        <Sidebar
          repoPath={state.repoPath}
          setRepoPath={state.setRepoPath}
          scanSummary={state.scanSummary}
          indexExists={state.indexExists}
          isActive={state.isActive}
          indexRepo={state.indexRepo}
          loadRepo={state.loadRepo}
          clearChat={state.clearChat}
          indexing={state.indexing}
          loading={state.loading}
          indexProgress={state.indexProgress}
          error={state.error}
          setError={state.setError}
          baseUrl={state.baseUrl}
          setBaseUrl={state.setBaseUrl}
          llmModel={state.llmModel}
          setLlmModel={state.setLlmModel}
          embeddingModel={state.embeddingModel}
          setEmbeddingModel={state.setEmbeddingModel}
        />
      </div>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="main-area">
        {/* Top bar */}
        <div className="topbar">
          <button
            id="topbar-toggle"
            className="topbar-hamburger"
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
          >
            ☰
          </button>

          <div className="topbar-crumb">
            {state.indexedPath ? (
              <>Exploring: <span className="crumb-active">{state.indexedPath}</span></>
            ) : (
              'No repository loaded'
            )}
          </div>

          <button
            id="topbar-home"
            className="btn btn-ghost btn-sm topbar-home-btn"
            onClick={() => navigate('/')}
          >
            ← Home
          </button>
        </div>

        {/* Chat window */}
        <ChatWindow
          messages={state.messages}
          querying={state.querying}
          isActive={state.isActive}
          indexedPath={state.indexedPath}
          sendMessage={state.sendMessage}
          EXAMPLES={state.EXAMPLES}
        />
      </div>
    </div>
  )
}
