"""
config.py — Central configuration for Talk-With-Repo.
Modify these values to customize scanning behaviour.
"""

# ── LLM / Embedding Models ────────────────────────────────────────────────────
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2" # Free, fast local embeddings
LLM_MODEL       = "gpt-4o-mini"              # Fast, cost-efficient OpenAI model
LLM_TEMPERATURE = 0.3

# ── Retrieval ─────────────────────────────────────────────────────────────────
RETRIEVER_K = 8          # Number of top-k chunks to retrieve per query

# ── Chunking ──────────────────────────────────────────────────────────────────
CHUNK_SIZE    = 800     # ~530 tokens/chunk — Original config size
CHUNK_OVERLAP = 100     # Enough overlap to preserve cross-chunk context
PARSER_THRESHOLD = 50    # LanguageParser: min token threshold to attempt parse
MIN_CHUNK_CHARS  = 120   # Discard chunks shorter than this (bare import/header lines)
EMBED_BATCH_SIZE = 1     # One chunk per incremental store call

# ── File Extensions to Index ──────────────────────────────────────────────────
SUPPORTED_SUFFIXES = [
    # ── Core languages (Language-aware AST splitting) ──────────────────────
    # NOTE: JS/JSX/TS/TSX require `pip install esprima` for smart chunking;
    #       without it they fall back to plain-text splitting (still indexed OK).
    ".py",   ".js",   ".ts",  ".jsx",  ".tsx",
    ".java", ".cpp",  ".c",   ".h",    ".hpp",
    ".go",   ".rs",   ".rb",  ".php",  ".cs",
    ".swift",".kt",   ".scala",

    # ── Web / templating (generic splitting) ──────────────────────────────
    ".html", ".htm",  ".css", ".scss", ".sass", ".less",
    ".svelte",".vue",

    # ── Config / data (generic splitting) ────────────────────────────────
    # NOTE: .env is excluded (security — contains secrets). Multi-dot extensions
    #       like .env.example never match via Path.suffix, so they are omitted.
    ".json", ".jsonc",
    ".yaml", ".yml",
    ".toml", ".ini",  ".cfg",  ".conf", ".properties",
    ".xml",  ".csv",

    # ── Shell / scripts (generic splitting) ─────────────────────────────
    # NOTE: Makefile/Dockerfile have no extension so .makefile/.dockerfile
    #       never match via Path.suffix. Use the file-name excludes below.
    ".sh",   ".bash", ".zsh",  ".fish",
    ".bat",  ".ps1",  ".cmd",

    # ── SQL / query languages (generic splitting) ─────────────────────────
    ".sql",  ".graphql", ".gql",

    # ── Docs / text (generic splitting) ──────────────────────────────────
    ".md",   ".mdx",  ".rst",  ".txt",
    ".adoc",

    # ── IaC / CI (generic splitting) ───────────────────────────────────
    ".tf",
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
    # ChromaDB stores — exclude entire vector DB directory (binary + index files)
    "**/.chroma_db/**",
    "**/chroma_stores/**",
    # Lock files — large and not useful for Q&A
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/poetry.lock",
    "**/Pipfile.lock",
    # Security: never index secret/credential files
    "**/.env",
    "**/.env.*",
    "**/secrets.*",
    "**/*.pem",
    "**/*.key",
    # Binary / compiled artifacts
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

# ── ChromaDB Persistence ──────────────────────────────────────────────────────
CHROMA_BASE_DIR = "./chroma_stores"  # Root dir; each repo gets a sub-folder
