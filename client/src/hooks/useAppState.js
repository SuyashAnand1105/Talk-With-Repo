import { useState, useCallback, useEffect, useRef } from 'react'

const EXAMPLES = [
  '💬 "What is the entry point of this application?"',
  '💬 "Which file handles API payload validation?"',
  '💬 "Show every function that imports from utils.js"',
  '💬 "How does the authentication flow work?"',
  '💬 "What design pattern is used for database access?"',
  '💬 "Trace the request lifecycle from HTTP call to DB query"',
]

/**
 * Central state hook for the App page.
 * Manages repo path, indexing, chat messages, and provider settings.
 */
export function useAppState() {
  // ── Repo ───────────────────────────────────────────────────────────────────
  const [repoPath,      setRepoPath]      = useState('')
  const [scanSummary,   setScanSummary]   = useState(null)
  const [indexExists,   setIndexExists]   = useState(false)
  const [isActive,      setIsActive]      = useState(false)
  const [indexedPath,   setIndexedPath]   = useState('')

  // ── Provider settings ──────────────────────────────────────────────────────
  const [baseUrl,        setBaseUrl]        = useState('')
  const [llmModel,       setLlmModel]       = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')

  // ── UI flags ───────────────────────────────────────────────────────────────
  const [indexing,      setIndexing]      = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [indexProgress, setIndexProgress] = useState([])
  const [error,         setError]         = useState(null)

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState([])
  const [querying,  setQuerying]  = useState(false)

  const scanTimer = useRef(null)

  // ── On mount: check if bridge already has a loaded repo ───────────────────
  useEffect(() => {
    fetch('/api/repo/status')
      .then(r => r.json())
      .then(data => {
        if (data.has_chain && data.indexed_path) {
          setIsActive(true)
          setIndexedPath(data.indexed_path)
          setRepoPath(data.indexed_path)
        }
      })
      .catch(() => {})
  }, [])

  // ── Debounced scan when repoPath changes ──────────────────────────────────
  useEffect(() => {
    const path = repoPath.trim().replace(/^["']|["']$/g, '')
    if (!path) {
      setScanSummary(null)
      setIndexExists(false)
      return
    }

    clearTimeout(scanTimer.current)
    scanTimer.current = setTimeout(async () => {
      try {
        const enc = encodeURIComponent(path)
        const [scanRes, existsRes] = await Promise.all([
          fetch(`/api/repo/scan?path=${enc}`).then(r => r.json()),
          fetch(`/api/repo/index-exists?path=${enc}`).then(r => r.json()),
        ])
        setScanSummary(scanRes)
        setIndexExists(Boolean(existsRes.exists))
      } catch {
        setScanSummary(null)
      }
    }, 650)

    return () => clearTimeout(scanTimer.current)
  }, [repoPath])

  // ── Index (SSE streaming) ─────────────────────────────────────────────────
  const indexRepo = useCallback(async () => {
    const path = repoPath.trim().replace(/^["']|["']$/g, '')
    if (!path || indexing) return

    setIndexing(true)
    setIndexProgress(['Starting…'])
    setError(null)

    try {
      const response = await fetch('/api/repo/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_path: path,
          base_url: baseUrl || undefined,
          llm_model: llmModel || undefined,
          embedding_model: embeddingModel || undefined,
        }),
      })

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop()               // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let evt
          try { evt = JSON.parse(line.slice(6)) } catch { continue }

          if (evt.type === 'progress') {
            setIndexProgress(prev => [...prev, evt.message])
          } else if (evt.type === 'done') {
            setIsActive(true)
            setIndexedPath(path)
            setMessages([])
            setIndexExists(true)
            setIndexing(false)
          } else if (evt.type === 'error') {
            setError(evt.message)
            setIndexing(false)
          }
        }
      }
    } catch (e) {
      setError(e.message)
      setIndexing(false)
    }
  }, [repoPath, baseUrl, llmModel, embeddingModel, indexing])

  // ── Load existing index ───────────────────────────────────────────────────
  const loadRepo = useCallback(async () => {
    const path = repoPath.trim().replace(/^["']|["']$/g, '')
    if (!path || loading) return

    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/repo/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_path: path,
          base_url: baseUrl || undefined,
          llm_model: llmModel || undefined,
          embedding_model: embeddingModel || undefined,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setIsActive(true)
        setIndexedPath(data.repo_path)
        setMessages([])
      } else {
        setError(data.error)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [repoPath, baseUrl, llmModel, embeddingModel, loading])

  // ── Send chat message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || querying) return

    setMessages(prev => [...prev, { role: 'user', content: question, sources: [] }])
    setQuerying(true)

    try {
      const res  = await fetch('/api/chat/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question }),
      })
      const data = await res.json()

      if (res.ok) {
        setMessages(prev => [...prev, {
          role:    'assistant',
          content: data.answer,
          sources: data.sources ?? [],
        }])
      } else {
        setMessages(prev => [...prev, {
          role:    'assistant',
          content: `❌ ${data.error}`,
          sources: [],
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: `❌ Network error: ${e.message}`,
        sources: [],
      }])
    } finally {
      setQuerying(false)
    }
  }, [querying])

  const clearChat = useCallback(() => setMessages([]), [])

  return {
    // Repo
    repoPath, setRepoPath,
    scanSummary,
    indexExists,
    isActive,
    indexedPath,
    // Settings
    baseUrl, setBaseUrl,
    llmModel, setLlmModel,
    embeddingModel, setEmbeddingModel,
    // Flags
    indexing,
    loading,
    indexProgress,
    error, setError,
    // Chat
    messages,
    querying,
    // Actions
    indexRepo,
    loadRepo,
    sendMessage,
    clearChat,
    // Constants
    EXAMPLES,
  }
}
