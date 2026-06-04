import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import CodeRain from '../components/CodeRain'

const FEATURES = [
  {
    icon: '🔍',
    title: 'Semantic Search',
    desc:  'Vector embeddings power deep understanding of your codebase — far beyond simple keyword matching.',
  },
  {
    icon: '🧠',
    title: 'AI-Powered Q&A',
    desc:  'Ask natural-language questions. Get grounded answers sourced directly from your code.',
  },
  {
    icon: '📂',
    title: 'Source Citations',
    desc:  'Every answer links back to the exact files where the logic lives — no guessing required.',
  },
]

const STACK_PILLS = [
  'RAG Pipeline', 'GPT-4o-mini', 'ChromaDB', 'text-embedding-3-small',
  'LangChain', 'tree-sitter', 'Python + Node.js',
]

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-root">
      {/* Animated code rain background */}
      <CodeRain opacity={0.16} />

      {/* Gradient overlays */}
      <div className="landing-overlay" />

      {/* Main content */}
      <div className="landing-content">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          {/* Badge */}
          <motion.div variants={item} className="landing-badge">
            <span className="landing-badge-dot" />
            AI Codebase Navigator
          </motion.div>

          {/* Title */}
          <motion.h1 variants={item} className="landing-title">
            Talk With{' '}
            <span className="gradient-text">Your Repo</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={item} className="landing-sub">
            Ask natural-language questions about any local codebase.<br />
            Powered by RAG, embeddings, and a persistent AI chain — results in seconds.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={item} className="cta-group">
            <motion.button
              id="cta-start"
              className="cta-primary"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/app')}
            >
              Start Exploring →
            </motion.button>

            <motion.button
              id="cta-github"
              className="cta-secondary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.open('https://github.com', '_blank')}
            >
              View on GitHub
            </motion.button>
          </motion.div>

          {/* Feature cards */}
          <motion.div variants={container} className="feature-grid">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={item}
                whileHover={{ y: -4, boxShadow: '0 12px 45px rgba(59,130,246,0.2)' }}
                className="feature-card"
              >
                <span className="feature-icon">{f.icon}</span>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tech stack pills */}
          <motion.div variants={item} className="landing-stack">
            {STACK_PILLS.map((pill) => (
              <span key={pill} className="stack-pill">{pill}</span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
