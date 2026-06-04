import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion } from 'framer-motion'

// Override code block background to match theme
const codeStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: 'rgba(11, 7, 29, 0.97)',
    margin: 0,
    borderRadius: '0',
    padding: '0.85rem 1rem',
    fontSize: '0.79rem',
    borderLeft: '2px solid rgba(251, 191, 36, 0.4)',
  },
}

function basename(filePath) {
  try { return filePath.split(/[\\/]/).pop() || filePath }
  catch { return filePath }
}

/**
 * Single message bubble — user (right) or assistant (left).
 * Renders markdown with syntax-highlighted code blocks and source chips.
 */
export default function MessageBubble({ role, content, sources = [], indexedPath = '' }) {
  const isUser = role === 'user'

  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      {/* Avatar */}
      <div className={`msg-avatar ${isUser ? 'avatar-user' : 'avatar-assistant'}`}>
        {isUser ? '✦' : '🔮'}
      </div>

      {/* Bubble */}
      <div className={`msg-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        <div className="bubble-content">
          {isUser ? (
            <p style={{ margin: 0 }}>{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={codeStyle}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        {/* Source chips */}
        {!isUser && sources.length > 0 && (
          <div className="source-chips">
            {sources.map((src, i) => {
              let display = src
              if (indexedPath) {
                // Make path relative to indexed repo
                try {
                  display = src.replace(indexedPath, '').replace(/^[/\\]/, '')
                } catch { display = basename(src) }
              }
              return (
                <motion.span
                  key={i}
                  className="source-chip"
                  initial={{ opacity: 0, scale: 0.8, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                  title={src}
                >
                  ◈ {display || basename(src)}
                </motion.span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
