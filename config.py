"""
config.py — Central configuration for Talk-With-Repo
"""

# ─────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────

# Local embeddings (free, fast)
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# OpenAI model for answering questions
LLM_MODEL = "gpt-4o-mini"

# Lower temperature = more accurate code explanations
LLM_TEMPERATURE = 0.2


# ─────────────────────────────────────────────────────────────
# Retrieval
# ─────────────────────────────────────────────────────────────

# Number of chunks retrieved for each question
RETRIEVER_K = 8


# ─────────────────────────────────────────────────────────────
# Chunking
# ─────────────────────────────────────────────────────────────

# Larger chunks preserve more code context
CHUNK_SIZE = 1000

# Overlap prevents context loss between chunks
CHUNK_OVERLAP = 150

# Minimum tokens before AST parser activates
PARSER_THRESHOLD = 50

# Ignore tiny chunks such as imports
MIN_CHUNK_CHARS = 120

# Local embeddings can safely process larger batches
EMBED_BATCH_SIZE = 32


# ─────────────────────────────────────────────────────────────
# Supported File Types
# ─────────────────────────────────────────────────────────────

SUPPORTED_SUFFIXES = [
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".cpp", ".c", ".h", ".hpp",
    ".go", ".rs", ".rb", ".php", ".cs",
    ".swift", ".kt", ".scala",

    ".html", ".htm",
    ".css", ".scss", ".sass", ".less",
    ".vue", ".svelte",

    ".json", ".jsonc",
    ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".conf",
    ".properties",

    ".xml", ".csv",

    ".sh", ".bash", ".zsh",
    ".fish", ".bat", ".cmd", ".ps1",

    ".sql", ".graphql", ".gql",

    ".md", ".mdx", ".rst", ".txt",

    ".tf",
]


# ─────────────────────────────────────────────────────────────
# Excluded Files / Directories
# ─────────────────────────────────────────────────────────────

EXCLUDED_PATTERNS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/__pycache__/**",
    "**/venv/**",
    "**/.venv/**",

    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",

    "**/.chroma_db/**",
    "**/chroma_stores/**",

    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/poetry.lock",
    "**/Pipfile.lock",

    "**/.env",
    "**/.env.*",
    "**/secrets.*",
    "**/*.pem",
    "**/*.key",

    "**/*.pyc",
    "**/*.pyo",
    "**/*.class",
    "**/*.so",
    "**/*.dll",
    "**/*.exe",
    "**/*.bin",
    "**/*.parquet",
    "**/*.arrow",
]


# ─────────────────────────────────────────────────────────────
# ChromaDB Storage
# ─────────────────────────────────────────────────────────────

CHROMA_BASE_DIR = "./chroma_stores"