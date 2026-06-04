import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import MagicParticles from '../components/MagicParticles'
import { useAppState } from '../hooks/useAppState'

export default function AppPage() {
  const navigate      = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const state = useAppState()

  const toggleSidebar = () => setSidebarOpen(o => !o)
  const closeSidebar  = () => isMobile && setSidebarOpen(false)

  return (
    <div className="app-layout">

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            key="overlay"
            className="sidebar-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      {/* ── Grimoire Sidebar ─────────────────────────────────────────────── */}
      <motion.div
        className={`sidebar ${isMobile ? (sidebarOpen ? 'mobile-open' : '') : (sidebarOpen ? '' : 'desktop-hidden')}`}
        style={{ position: isMobile ? 'fixed' : 'relative' }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0,   opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Sidebar
          repoPath={state.repoPath}         setRepoPath={state.setRepoPath}
          scanSummary={state.scanSummary}   indexExists={state.indexExists}
          isActive={state.isActive}
          indexRepo={state.indexRepo}
          clearChat={state.clearChat}
          indexing={state.indexing}
          indexProgress={state.indexProgress}
          error={state.error}               setError={state.setError}
          baseUrl={state.baseUrl}           setBaseUrl={state.setBaseUrl}
          llmModel={state.llmModel}         setLlmModel={state.setLlmModel}
          embeddingModel={state.embeddingModel} setEmbeddingModel={state.setEmbeddingModel}
        />
      </motion.div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <motion.div
        className="main-area"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0  }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Arcane topbar */}
        <motion.div
          className="topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <motion.button
            id="topbar-toggle"
            className="topbar-hamburger"
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
            whileHover={{ scale: 1.15, color: 'var(--gold-400)' }}
            whileTap={{ scale: 0.9 }}
          >
            ☰
          </motion.button>

          <div className="topbar-crumb">
            {state.indexedPath ? (
              <>Exploring: <span className="crumb-active">{state.indexedPath}</span></>
            ) : (
              'No repository loaded'
            )}
          </div>

          <motion.button
            id="topbar-home"
            className="btn btn-ghost btn-sm topbar-home-btn"
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ← Home
          </motion.button>
        </motion.div>

        {/* Chat window with particle background */}
        <ChatWindow
          messages={state.messages}
          querying={state.querying}
          isActive={state.isActive}
          indexedPath={state.indexedPath}
          sendMessage={state.sendMessage}
          EXAMPLES={state.EXAMPLES}
        />
      </motion.div>
    </div>
  )
}
