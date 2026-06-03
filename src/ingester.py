"""
src/ingester.py — File scanning, loading, and syntax-aware parsing.

Responsibilities:
  • Crawl a local repository directory for supported code files.
  • Use LangChain's GenericLoader + LanguageParser for context-clean chunking.
  • Preserve file-path metadata on every Document chunk.
  • Return a list of Document objects ready for embedding.
"""

import os
import logging
from pathlib import Path
from typing import List

from langchain_community.document_loaders.generic import GenericLoader
from langchain_community.document_loaders.parsers import LanguageParser
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from langchain_core.documents import Document

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config

logger = logging.getLogger(__name__)

# ── Extension → LangChain Language mapping ────────────────────────────────────
_LANGUAGE_MAP = {
    ".py":   Language.PYTHON,
    ".js":   Language.JS,
    ".ts":   Language.TS,
    ".html": Language.HTML,
    ".java": Language.JAVA,
    ".cpp":  Language.CPP,
    ".c":    Language.C,
    ".go":   Language.GO,
    ".rs":   Language.RUST,
}


def _make_text_splitter(language: Language | None) -> RecursiveCharacterTextSplitter:
    """Return a language-aware splitter, falling back to generic if None."""
    kwargs = dict(chunk_size=config.CHUNK_SIZE, chunk_overlap=config.CHUNK_OVERLAP)
    if language is not None:
        try:
            return RecursiveCharacterTextSplitter.from_language(language=language, **kwargs)
        except Exception:
            pass
    return RecursiveCharacterTextSplitter(**kwargs)


def load_and_split_codebase(repo_path: str) -> List[Document]:
    """
    Crawl *repo_path*, parse source files with LanguageParser, and return
    a flat list of Document chunks with ``source`` metadata intact.

    Args:
        repo_path: Absolute path to the local repository root.

    Returns:
        List of Document chunks ready for embedding.

    Raises:
        FileNotFoundError: If *repo_path* does not exist.
        ValueError: If no supported files are found.
    """
    repo_path = os.path.abspath(repo_path)
    if not os.path.isdir(repo_path):
        raise FileNotFoundError(f"Repository path does not exist: {repo_path}")

    logger.info("Scanning repository: %s", repo_path)

    # ── Load with syntax-aware LanguageParser ─────────────────────────────────
    try:
        loader = GenericLoader.from_filesystem(
            repo_path,
            glob="**/*",
            suffixes=config.SUPPORTED_SUFFIXES,
            exclude=config.EXCLUDED_PATTERNS,
            parser=LanguageParser(parser_threshold=config.PARSER_THRESHOLD),
        )
        raw_documents = loader.load()
    except Exception as exc:
        logger.warning("LanguageParser failed (%s); falling back to plain text loader.", exc)
        raw_documents = _fallback_load(repo_path)

    if not raw_documents:
        raise ValueError(
            f"No supported source files found in '{repo_path}'.\n"
            f"Supported extensions: {', '.join(config.SUPPORTED_SUFFIXES)}"
        )

    logger.info("Loaded %d raw document sections.", len(raw_documents))

    # ── Split using language-aware chunkers ────────────────────────────────────
    all_chunks: List[Document] = []
    for doc in raw_documents:
        src = doc.metadata.get("source", "")
        ext = Path(src).suffix.lower()
        lang = _LANGUAGE_MAP.get(ext)
        splitter = _make_text_splitter(lang)
        chunks = splitter.split_documents([doc])
        all_chunks.extend(chunks)

    logger.info("Split into %d chunks (chunk_size=%d, overlap=%d).",
                len(all_chunks), config.CHUNK_SIZE, config.CHUNK_OVERLAP)

    return all_chunks


# ── Fallback: plain TextLoader when LanguageParser is unavailable ─────────────

def _fallback_load(repo_path: str) -> List[Document]:
    """Walk the directory and load files as plain text Documents."""
    from langchain_community.document_loaders import TextLoader

    documents: List[Document] = []
    excluded_dirs = {"node_modules", ".git", "__pycache__", "venv", ".venv",
                     "dist", "build", ".chroma_db", "chroma_stores"}

    for root, dirs, files in os.walk(repo_path):
        # Prune excluded directories in-place
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        for fname in files:
            if Path(fname).suffix.lower() in config.SUPPORTED_SUFFIXES:
                fpath = os.path.join(root, fname)
                try:
                    loader = TextLoader(fpath, encoding="utf-8", autodetect_encoding=True)
                    documents.extend(loader.load())
                except Exception as exc:
                    logger.warning("Skipping %s: %s", fpath, exc)

    return documents


def get_file_summary(repo_path: str) -> dict:
    """
    Return a lightweight summary of indexed files without loading content.
    Useful for the UI to show what will be scanned before indexing.
    """
    repo_path = os.path.abspath(repo_path)
    if not os.path.isdir(repo_path):
        return {"error": f"Path not found: {repo_path}"}

    excluded_dirs = {"node_modules", ".git", "__pycache__", "venv", ".venv",
                     "dist", "build", ".chroma_db", "chroma_stores"}
    files_by_ext: dict[str, int] = {}
    total = 0

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        for fname in files:
            ext = Path(fname).suffix.lower()
            if ext in config.SUPPORTED_SUFFIXES:
                files_by_ext[ext] = files_by_ext.get(ext, 0) + 1
                total += 1

    return {"total": total, "by_extension": files_by_ext, "repo_path": repo_path}
