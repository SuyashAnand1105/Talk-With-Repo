"""
src/engine.py — Vector storage, retrieval, and QA chain construction.

Responsibilities:
  • Create or load a ChromaDB vector store per repository (path-hashed dir).
  • Build a LangChain RetrievalChain backed by OpenAI gpt-4o-mini + text-embedding-3-small.
  • Expose a clean query() helper that returns answer + source citations.
"""

import os
import hashlib
import logging
from pathlib import Path
from typing import List, Tuple

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config

logger = logging.getLogger(__name__)


# ── Utility: deterministic persist-dir per repo ───────────────────────────────

def _get_persist_dir(repo_path: str) -> str:
    """
    Derive a unique ChromaDB persist directory from the repository path.
    This ensures each scanned codebase has its own isolated vector store.
    """
    path_hash = hashlib.md5(os.path.abspath(repo_path).encode()).hexdigest()[:12]
    return os.path.join(config.CHROMA_BASE_DIR, f"repo_{path_hash}")


def index_exists(repo_path: str) -> bool:
    """Return True if a persist directory already exists for *repo_path*."""
    persist_dir = _get_persist_dir(repo_path)
    return os.path.isdir(persist_dir) and any(Path(persist_dir).iterdir())


# ── Embeddings (shared instance) ──────────────────────────────────────────────

def _get_embeddings(
    base_url: str | None = None,
    model: str | None = None,
) -> OpenAIEmbeddings:
    kwargs: dict = {"model": model or config.EMBEDDING_MODEL}
    if base_url:
        kwargs["openai_api_base"] = base_url
    return OpenAIEmbeddings(**kwargs)


# ── Vector Store ──────────────────────────────────────────────────────────────

def build_vector_store(
    docs: List[Document],
    repo_path: str,
    base_url: str | None = None,
    embedding_model: str | None = None,
) -> Chroma:
    """
    Embed *docs* and persist them to a ChromaDB directory derived from *repo_path*.

    Args:
        docs: Chunked Document objects from the ingester.
        repo_path: The repository root (used to derive persist_directory).
        base_url: Optional API base URL for the embedding provider.
        embedding_model: Optional model name override.

    Returns:
        A ready-to-query Chroma vector store.
    """
    persist_dir = _get_persist_dir(repo_path)
    os.makedirs(persist_dir, exist_ok=True)

    logger.info("Building vector store → %s  (%d chunks)", persist_dir, len(docs))

    embeddings = _get_embeddings(base_url=base_url, model=embedding_model)
    vector_store = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=persist_dir,
    )

    logger.info("Vector store built and persisted.")
    return vector_store


def load_vector_store(
    repo_path: str,
    base_url: str | None = None,
    embedding_model: str | None = None,
) -> Chroma:
    """
    Load an existing ChromaDB store for *repo_path* without re-ingesting.

    Args:
        base_url: Optional API base URL for the embedding provider.
        embedding_model: Optional model name override.

    Raises:
        FileNotFoundError: If no index exists for the given path.
    """
    persist_dir = _get_persist_dir(repo_path)
    if not os.path.isdir(persist_dir):
        raise FileNotFoundError(
            f"No index found for '{repo_path}'. Please index the codebase first."
        )

    logger.info("Loading existing vector store from %s", persist_dir)
    embeddings = _get_embeddings(base_url=base_url, model=embedding_model)
    return Chroma(persist_directory=persist_dir, embedding_function=embeddings)


# ── QA Chain ─────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are an elite software architecture analyst and codebase companion.

Your role is to answer questions about the provided codebase using ONLY the \
code fragments supplied in the context below. Always:

1. Identify the exact file(s) where the relevant logic lives (use the `source` \
   paths from the context).
2. Trace call stacks, class hierarchies, or data-flow pipelines when relevant.
3. Quote short code snippets to support your answer where helpful.
4. If the answer cannot be determined from the provided context, say so clearly \
   instead of guessing.

Context (code fragments retrieved from the repository):
{context}
"""


def create_qa_chain(
    vector_store: Chroma,
    base_url: str | None = None,
    llm_model: str | None = None,
):
    """
    Construct and return a LangChain RetrievalChain for code Q&A.

    Args:
        vector_store: An initialised Chroma vector store.
        base_url: Optional API base URL for the LLM provider.
        llm_model: Optional model name override.

    Returns:
        A runnable chain that accepts {"input": question} and returns
        {"answer": str, "context": List[Document]}.
    """
    llm_kwargs: dict = {
        "model": llm_model or config.LLM_MODEL,
        "temperature": config.LLM_TEMPERATURE,
    }
    if base_url:
        llm_kwargs["base_url"] = base_url

    llm = ChatOpenAI(**llm_kwargs)

    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_PROMPT),
        ("human", "{input}"),
    ])

    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": config.RETRIEVER_K},
    )

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)


# ── High-level query helper ───────────────────────────────────────────────────

def query_codebase(chain, question: str) -> Tuple[str, List[str]]:
    """
    Run *question* through *chain* and return (answer, unique_source_paths).

    Args:
        chain: A chain returned by create_qa_chain().
        question: Natural-language question about the codebase.

    Returns:
        Tuple of (answer_text, list_of_source_file_paths).
    """
    result = chain.invoke({"input": question})

    answer: str = result.get("answer", "No answer generated.")

    # Collect unique source paths from retrieved context docs
    seen: set[str] = set()
    sources: List[str] = []
    for doc in result.get("context", []):
        src = doc.metadata.get("source", "unknown")
        if src not in seen:
            seen.add(src)
            sources.append(src)

    return answer, sources
