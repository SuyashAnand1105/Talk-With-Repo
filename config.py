"""
config.py — Central configuration for Talk-With-Repo.
Modify these values to customize scanning behaviour.
"""

# ── LLM / Embedding Models ────────────────────────────────────────────────────
EMBEDDING_MODEL = "text-embedding-3-small"   # OpenAI embeddings
LLM_MODEL       = "gpt-4o-mini"              # Fast, cost-efficient OpenAI model
LLM_TEMPERATURE = 0.2

# ── Retrieval ─────────────────────────────────────────────────────────────────
RETRIEVER_K = 6          # Number of top-k chunks to retrieve per query

# ── Chunking ──────────────────────────────────────────────────────────────────
CHUNK_SIZE    = 2000
CHUNK_OVERLAP = 200
PARSER_THRESHOLD = 50    # LanguageParser: min token threshold to attempt parse

# ── File Extensions to Index ──────────────────────────────────────────────────
SUPPORTED_SUFFIXES = [
    ".py",
    ".js",
    ".ts",
    ".html",
    ".css",
    ".java",
    ".cpp",
    ".c",
    ".go",
    ".rs",
    ".md",
]

# ── Directories / Files to Exclude ────────────────────────────────────────────
EXCLUDED_PATTERNS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/__pycache__/**",
    "**/venv/**",
    "**/.venv/**",
    "**/dist/**",
    "**/build/**",
    "**/.chroma_db/**",
    "**/chroma_stores/**",
]

# ── ChromaDB Persistence ──────────────────────────────────────────────────────
CHROMA_BASE_DIR = "./chroma_stores"  # Root dir; each repo gets a sub-folder
