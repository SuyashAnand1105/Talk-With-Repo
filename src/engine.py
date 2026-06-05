"""
src/engine.py — Vector storage, retrieval, and QA chain construction.

Responsibilities:
  • Create or load a ChromaDB vector store per repository (path-hashed dir).
  • Build a LangChain RetrievalChain backed by OpenAI gpt-4o-mini + text-embedding-3-small.
  • Expose a clean query() helper that returns answer + source citations.
"""

import os
import shutil
import time
import hashlib
import logging
from pathlib import Path
from typing import List, Tuple, Callable, Any

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
# pyrefly: ignore [missing-import]
from langchain_huggingface import HuggingFaceEmbeddings
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


# ── Rate-limit-safe Embeddings wrapper ────────────────────────────────────

class _RetryEmbeddings(OpenAIEmbeddings):
    """
    Thin subclass that retries ``embed_documents`` and ``embed_query``
    on HTTP 429 (rate-limit) errors with exponential back-off.
    """

    # Use different names to avoid shadowing OpenAI parent attrs
    _rl_max_attempts: int = 10
    _rl_base_wait:    int = 62   # seconds — one full minute to clear the window

    def _call_with_backoff(self, fn: Callable, *args: Any, **kwargs: Any) -> Any:
        wait = self._rl_base_wait
        for attempt in range(self._rl_max_attempts):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:
                is_rate_limit = '429' in str(exc) or 'rate limit' in str(exc).lower()
                if is_rate_limit and attempt < self._rl_max_attempts - 1:
                    logger.warning(
                        "Embedding rate-limited (429); waiting %ds before retry "
                        "%d/%d …", wait, attempt + 1, self._rl_max_attempts
                    )
                    time.sleep(wait)
                    wait = min(wait * 2, 300)   # cap at 5 minutes
                else:
                    raise

    def embed_documents(self, texts, **kwargs):
        return self._call_with_backoff(super().embed_documents, texts, **kwargs)

    def embed_query(self, text, **kwargs):
        return self._call_with_backoff(super().embed_query, text, **kwargs)


# ── Embeddings factory ──────────────────────────────────────────────────────

def _get_embeddings(
    base_url: str | None = None,
    model: str | None = None,
) -> Any:
    """
    Return an embedding client. If the model starts with 'local:' or 'sentence-transformers',
    it will use local HuggingFace embeddings which are free and extremely fast.
    Otherwise, it uses the rate-limit-safe OpenAI wrapper.
    """
    model_name = model or config.EMBEDDING_MODEL
    
    if model_name.startswith("local:") or "sentence-transformers" in model_name or "mini" in model_name.lower():
        logger.info(f"Using local HuggingFace embeddings: {model_name}")
        return HuggingFaceEmbeddings(model_name=model_name.replace("local:", ""))
    
    kwargs: dict = {
        "model":      model_name,
        "chunk_size": config.EMBED_BATCH_SIZE,   # texts per API call
    }
    if base_url:
        kwargs["openai_api_base"] = base_url
    return _RetryEmbeddings(**kwargs)


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

    # ── Always start clean ────────────────────────────────────────────────────
    # On Windows, ChromaDB SQLite files stay locked until the process exits.
    # Instead of deleting the physical directory (which causes WinError 32),
    # we connect to the existing database and delete the collection contents.
    if os.path.isdir(persist_dir):
        try:
            old_vs = Chroma(persist_directory=persist_dir, embedding_function=None)
            old_vs.delete_collection()
            logger.info("Cleared stale vector collection in %s", persist_dir)
        except Exception as e:
            logger.warning("Could not clear old collection: %s", e)
            
    os.makedirs(persist_dir, exist_ok=True)

    logger.info("Building vector store → %s  (%d chunks)", persist_dir, len(docs))

    embeddings  = _get_embeddings(base_url=base_url, model=embedding_model)
    vs: Chroma | None = None

    # If using fast local embeddings, we can embed all documents at once
    if isinstance(embeddings, HuggingFaceEmbeddings):
        logger.info("Local embeddings detected: indexing all %d chunks at once…", len(docs))
        vs = Chroma.from_documents(
            documents=docs,
            embedding=embeddings,
            persist_directory=persist_dir,
        )
        logger.info("Vector store built and persisted instantly.")
        return vs

    # ── Incremental embedding for rate-limited APIs ────────────────────────────
    BATCH       = max(1, config.EMBED_BATCH_SIZE)
    total_batch = (len(docs) + BATCH - 1) // BATCH

    for batch_idx in range(0, len(docs), BATCH):
        batch = docs[batch_idx : batch_idx + BATCH]
        batch_num = batch_idx // BATCH + 1

        for attempt in range(10):
            try:
                if vs is None:
                    vs = Chroma.from_documents(
                        documents=batch,
                        embedding=embeddings,
                        persist_directory=persist_dir,
                    )
                else:
                    vs.add_documents(batch)
                logger.info("  [%d/%d] batch embedded.", batch_num, total_batch)
                break

            except Exception as exc:
                is_rl = "429" in str(exc) or "rate limit" in str(exc).lower()
                if is_rl and attempt < 9:
                    wait = min(65 * (attempt + 1), 300)
                    logger.warning(
                        "  [%d/%d] rate-limited; retrying in %ds (attempt %d/10)…",
                        batch_num, total_batch, wait, attempt + 1,
                    )
                    time.sleep(wait)
                else:
                    raise

    logger.info("Vector store built and persisted (%d batches).", total_batch)
    return vs


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
You are an expert software engineer and patient mentor embedded directly inside this codebase.
Your goal is not just to answer questions — it is to genuinely teach the person asking,
as if you were a senior engineer doing a deep-dive code walkthrough with a colleague.

━━━ HOW TO RESPOND ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Start with the "big picture"** — briefly explain what the relevant piece of the \
system does and why it exists, before diving into implementation details.

2. **Walk through the code step-by-step** — trace execution flow from entry point to \
outcome. Explain *what* each part does AND *why* it was written that way.

3. **Quote the relevant code** — use fenced code blocks with language tags. Always \
show the exact lines from the retrieved context. Never fabricate code.

4. **Name the file clearly** — every time you reference code, state its path \
(from the `source` metadata) so the reader knows exactly where to look.

5. **Explain design decisions** — when you can infer *why* something was built a \
certain way (e.g. "this uses a FIFO queue to prevent concurrent writes to the \
Python bridge"), say so.

6. **Use analogies** where helpful — if a concept is complex, a one-sentence analogy \
("think of this like a caching layer that…") can make it click immediately.

7. **Surface connections** — if the answer involves multiple files or layers, show \
how they connect: "Component A calls → B, which triggers → C in engine.py".

8. **Point to follow-up areas** — end with 1–2 sentences on what the user might \
want to explore next to deepen their understanding.

9. **Admit uncertainty honestly** — if the retrieved context does not contain enough \
information to answer fully, say "The context doesn't show X clearly, but based on \
what I can see…" rather than guessing silently.

━━━ FORMATTING RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Use **bold** for key terms, file names, and important concepts.
- Use `inline code` for function names, variables, class names, and short expressions.
- Use fenced code blocks for any multi-line code. Always specify the language.
- Use numbered lists for sequential steps / execution flows.
- Use bullet lists for properties, options, or non-ordered facts.
- Keep paragraphs short and scannable.

━━━ CONTEXT (retrieved code fragments) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
        search_type="mmr",                     # Max Marginal Relevance — balances relevance + diversity
        search_kwargs={
            "k":           config.RETRIEVER_K, # chunks returned to the LLM
            "fetch_k":     config.RETRIEVER_K * 5,  # wider candidate pool before MMR re-rank
            "lambda_mult": 0.65,               # 0=max diversity, 1=max relevance
        },
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
