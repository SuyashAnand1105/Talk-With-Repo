"""
bridge.py — Persistent JSON-over-stdio bridge for Talk-With-Repo.

Launched once by the Node.js server. Reads newline-delimited JSON commands
from stdin and writes newline-delimited JSON responses to stdout.
The QA chain and indexed path are kept in memory between commands.

Protocol
--------
stdin  : one JSON object per line  { "cmd": "<name>", ...args }
stdout : one or more JSON lines    { "type": "progress"|"done"|"error", ... }
stderr : Python logging (ignored by Node)

Commands
--------
  scan         { repo_path }
  index_exists { repo_path }
  index        { repo_path, base_url?, llm_model?, embedding_model? }
  load         { repo_path, base_url?, llm_model?, embedding_model? }
  query        { question }
  status       {}
"""

import sys
import json
import logging
from pathlib import Path

# ── Logging → stderr only (stdout is the JSON wire protocol) ──────────────────
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Path bootstrap ─────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

import config  # noqa: E402
from src.ingester import load_and_split_codebase, get_file_summary  # noqa: E402
from src.engine import (  # noqa: E402
    build_vector_store,
    load_vector_store,
    create_qa_chain,
    query_codebase,
    index_exists,
)

# ── In-memory state ────────────────────────────────────────────────────────────
_qa_chain = None
_indexed_path: str | None = None


# ── Wire helpers ───────────────────────────────────────────────────────────────

def _send(obj: dict) -> None:
    """Encode *obj* as JSON, write to stdout, and flush immediately."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


# ── Command handlers ───────────────────────────────────────────────────────────

def cmd_scan(p: dict) -> None:
    repo_path = p.get("repo_path", "").strip()
    summary = get_file_summary(repo_path)
    _send({"type": "done", "data": summary})


def cmd_index_exists(p: dict) -> None:
    repo_path = p.get("repo_path", "").strip()
    _send({"type": "done", "data": {"exists": index_exists(repo_path)}})


def cmd_index(p: dict) -> None:
    global _qa_chain, _indexed_path

    repo_path       = p.get("repo_path", "").strip()
    base_url        = p.get("base_url") or None
    embedding_model = p.get("embedding_model") or None
    llm_model       = p.get("llm_model") or None

    try:
        _send({"type": "progress", "message": "📂 Scanning and parsing source files…"})
        docs = load_and_split_codebase(repo_path)

        _send({"type": "progress", "message": f"✅ Parsed {len(docs)} chunks — generating embeddings…"})
        vs = build_vector_store(docs, repo_path, base_url=base_url, embedding_model=embedding_model)

        _send({"type": "progress", "message": "🔗 Building retrieval chain…"})
        _qa_chain     = create_qa_chain(vs, base_url=base_url, llm_model=llm_model)
        _indexed_path = repo_path

        _send({"type": "done", "data": {"chunks": len(docs), "repo_path": repo_path}})

    except Exception as exc:
        logger.exception("Indexing failed")
        _send({"type": "error", "message": str(exc)})


def cmd_load(p: dict) -> None:
    global _qa_chain, _indexed_path

    repo_path       = p.get("repo_path", "").strip()
    base_url        = p.get("base_url") or None
    embedding_model = p.get("embedding_model") or None
    llm_model       = p.get("llm_model") or None

    try:
        vs = load_vector_store(repo_path, base_url=base_url, embedding_model=embedding_model)
        _qa_chain     = create_qa_chain(vs, base_url=base_url, llm_model=llm_model)
        _indexed_path = repo_path
        _send({"type": "done", "data": {"repo_path": repo_path}})
    except Exception as exc:
        logger.exception("Load failed")
        _send({"type": "error", "message": str(exc)})


def cmd_query(p: dict) -> None:
    question = p.get("question", "").strip()

    if _qa_chain is None:
        _send({"type": "error", "message": "No codebase loaded. Index or load a repository first."})
        return

    try:
        answer, sources = query_codebase(_qa_chain, question)
        _send({"type": "done", "data": {
            "answer":       answer,
            "sources":      sources,
            "indexed_path": _indexed_path,
        }})
    except Exception as exc:
        logger.exception("Query failed")
        _send({"type": "error", "message": str(exc)})


def cmd_status(_p: dict) -> None:
    _send({"type": "done", "data": {
        "has_chain":    _qa_chain is not None,
        "indexed_path": _indexed_path,
    }})


HANDLERS = {
    "scan":          cmd_scan,
    "index_exists":  cmd_index_exists,
    "index":         cmd_index,
    "load":          cmd_load,
    "query":         cmd_query,
    "status":        cmd_status,
}


# ── Main loop ──────────────────────────────────────────────────────────────────

def main() -> None:
    _send({"type": "ready"})   # Signal readiness to Node.js

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue

        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            _send({"type": "error", "message": f"JSON parse error: {exc}"})
            continue

        cmd     = payload.get("cmd")
        handler = HANDLERS.get(cmd)

        if handler is None:
            _send({"type": "error", "message": f"Unknown command: {cmd!r}"})
            continue

        try:
            handler(payload)
        except Exception as exc:
            logger.exception("Unhandled error in handler %r", cmd)
            _send({"type": "error", "message": str(exc)})


if __name__ == "__main__":
    main()
