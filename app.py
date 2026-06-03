"""
app.py — Talk-With-Repo: AI Codebase Navigator
Streamlit frontend that ties together the ingester and engine modules.
"""

import os
import sys
import logging
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

# ── Bootstrap ─────────────────────────────────────────────────────────────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))
from src.ingester import load_and_split_codebase, get_file_summary
from src.engine import (
    build_vector_store,
    load_vector_store,
    create_qa_chain,
    query_codebase,
    index_exists,
)

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Talk-With-Repo | AI Codebase Navigator",
    page_icon="🔭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* ── Google Font ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Root & Base ── */
html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

/* ── Dark background gradient ── */
.stApp {
    background: linear-gradient(135deg, #0a0e1a 0%, #0d1526 50%, #0a1020 100%);
    min-height: 100vh;
}

/* ── Sidebar ── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0d1a2e 0%, #091525 100%);
    border-right: 1px solid rgba(99, 179, 237, 0.15);
}

[data-testid="stSidebar"] .stMarkdown h1,
[data-testid="stSidebar"] .stMarkdown h2,
[data-testid="stSidebar"] .stMarkdown h3 {
    color: #63b3ed;
}

/* ── Hero title in main area ── */
.hero-title {
    background: linear-gradient(135deg, #63b3ed, #9f7aea, #68d391);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: 2.6rem;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.2;
    margin-bottom: 0.25rem;
}

.hero-sub {
    color: #718096;
    font-size: 1rem;
    margin-bottom: 2rem;
}

/* ── Status badges ── */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    margin-top: 0.5rem;
}

.badge-success {
    background: rgba(104, 211, 145, 0.12);
    border: 1px solid rgba(104, 211, 145, 0.4);
    color: #68d391;
}

.badge-warning {
    background: rgba(246, 173, 85, 0.12);
    border: 1px solid rgba(246, 173, 85, 0.4);
    color: #f6ad55;
}

.badge-info {
    background: rgba(99, 179, 237, 0.12);
    border: 1px solid rgba(99, 179, 237, 0.4);
    color: #63b3ed;
}

/* ── Stat cards ── */
.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.6rem;
    margin: 0.8rem 0;
}

.stat-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    text-align: center;
}

.stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #63b3ed;
    line-height: 1;
}

.stat-label {
    font-size: 0.68rem;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.2rem;
}

/* ── Chat messages ── */
[data-testid="stChatMessage"] {
    background: rgba(255,255,255,0.03) !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    border-radius: 14px !important;
    backdrop-filter: blur(10px);
    margin-bottom: 0.75rem !important;
}

/* ── Source expander ── */
[data-testid="stExpander"] {
    background: rgba(99, 179, 237, 0.04) !important;
    border: 1px solid rgba(99, 179, 237, 0.15) !important;
    border-radius: 10px !important;
    margin-top: 0.5rem;
}

/* ── Code font inside chat ── */
code {
    font-family: 'JetBrains Mono', monospace !important;
    background: rgba(255,255,255,0.06) !important;
    border-radius: 4px;
    padding: 0.1em 0.35em;
}

/* ── Input styling ── */
.stTextInput input, .stTextArea textarea {
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(99, 179, 237, 0.25) !important;
    border-radius: 8px !important;
    color: #e2e8f0 !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.85rem !important;
}

.stTextInput input:focus, .stTextArea textarea:focus {
    border-color: rgba(99, 179, 237, 0.6) !important;
    box-shadow: 0 0 0 3px rgba(99, 179, 237, 0.1) !important;
}

/* ── Button ── */
.stButton > button {
    background: linear-gradient(135deg, #3182ce, #553c9a) !important;
    border: none !important;
    border-radius: 8px !important;
    color: white !important;
    font-weight: 600 !important;
    letter-spacing: 0.02em !important;
    transition: all 0.2s ease !important;
    width: 100%;
}

.stButton > button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(49, 130, 206, 0.4) !important;
}

/* ── Welcome state ── */
.welcome-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 2.5rem;
    text-align: center;
    margin-top: 3rem;
}

.welcome-icon {
    font-size: 3.5rem;
    margin-bottom: 1rem;
}

.welcome-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 0.5rem;
}

.welcome-text {
    color: #718096;
    font-size: 0.9rem;
    line-height: 1.6;
    max-width: 480px;
    margin: 0 auto;
}

.example-queries {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.5rem;
    text-align: left;
}

.query-chip {
    background: rgba(99, 179, 237, 0.07);
    border: 1px solid rgba(99, 179, 237, 0.2);
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    font-size: 0.82rem;
    color: #a0aec0;
    font-family: 'JetBrains Mono', monospace;
}

/* ── Divider ── */
hr {
    border-color: rgba(255,255,255,0.07) !important;
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(99, 179, 237, 0.3); border-radius: 3px; }
</style>
""", unsafe_allow_html=True)


# ── Session State Defaults ─────────────────────────────────────────────────────
def _init_state():
    defaults = {
        "messages": [],          # List of {"role": ..., "content": ..., "sources": [...]}
        "qa_chain": None,        # Active RetrievalChain
        "indexed_path": None,    # Repo path that is currently indexed
        "indexing": False,       # Guard flag during indexing
        # Provider settings
        "base_url": os.getenv("OPENAI_BASE_URL", "").strip(),
        "llm_model": os.getenv("OPENAI_LLM_MODEL", "").strip(),
        "embedding_model": os.getenv("OPENAI_EMBEDDING_MODEL", "").strip(),
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_state()


# ── Helper: validate API key ───────────────────────────────────────────────────
def _check_api_key() -> bool:
    key = os.getenv("OPENAI_API_KEY", "")
    return bool(key and key != "your_api_key_here")


# ── Helpers: resolve active provider settings ─────────────────────────────────
def _base_url() -> str | None:
    """Return base_url from session state, or None if empty."""
    v = st.session_state.get("base_url", "").strip()
    return v if v else None

def _llm_model() -> str | None:
    v = st.session_state.get("llm_model", "").strip()
    return v if v else None

def _embedding_model() -> str | None:
    v = st.session_state.get("embedding_model", "").strip()
    return v if v else None


# ── Helper: load chain for a repo ─────────────────────────────────────────────
def _load_chain_for_repo(repo_path: str):
    """Load an existing index (no re-ingestion) and set session chain."""
    vs = load_vector_store(repo_path, base_url=_base_url(), embedding_model=_embedding_model())
    st.session_state.qa_chain = create_qa_chain(vs, base_url=_base_url(), llm_model=_llm_model())
    st.session_state.indexed_path = repo_path
    st.session_state.messages = []


def _build_chain_for_repo(repo_path: str, progress_placeholder):
    """Ingest + embed + persist, then set session chain."""
    with progress_placeholder:
        with st.spinner("📂 Scanning and parsing source files…"):
            docs = load_and_split_codebase(repo_path)

        st.info(f"✅ Parsed **{len(docs)}** chunks — now embedding…")

        with st.spinner("🔢 Generating embeddings (this may take a moment)…"):
            vs = build_vector_store(docs, repo_path, base_url=_base_url(), embedding_model=_embedding_model())

    st.session_state.qa_chain = create_qa_chain(vs, base_url=_base_url(), llm_model=_llm_model())
    st.session_state.indexed_path = repo_path
    st.session_state.messages = []


# ══════════════════════════════════════════════════════════════════════════════
#  SIDEBAR
# ══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("## 🔭 Talk-With-Repo")
    st.markdown("<p style='color:#718096;font-size:0.82rem;margin-top:-0.5rem;'>AI Codebase Navigator</p>", unsafe_allow_html=True)
    st.divider()

    # ── API Key warning ────────────────────────────────────────────────────────
    if not _check_api_key():
        st.error("⚠️ **OPENAI_API_KEY** not set.\nAdd it to your `.env` file.", icon="🔑")
        st.stop()

    st.markdown("### 📁 Repository")
    repo_input = st.text_input(
        "Local repository path",
        placeholder="e.g.  C:/Projects/my-app",
        help="Absolute path to the root of the codebase you want to explore.",
        label_visibility="collapsed",
    )

    repo_path_clean = repo_input.strip().strip('"').strip("'") if repo_input else ""

    # ── File preview ────────────────────────────────────────────────────────────
    if repo_path_clean and os.path.isdir(repo_path_clean):
        summary = get_file_summary(repo_path_clean)
        if "error" not in summary:
            total = summary["total"]
            by_ext = summary["by_extension"]

            st.markdown(
                f"<div class='stat-grid'>"
                f"  <div class='stat-card'><div class='stat-value'>{total}</div><div class='stat-label'>Files found</div></div>"
                + "".join(
                    f"<div class='stat-card'><div class='stat-value'>{cnt}</div><div class='stat-label'>{ext}</div></div>"
                    for ext, cnt in sorted(by_ext.items(), key=lambda x: -x[1])[:4]
                )
                + "</div>",
                unsafe_allow_html=True,
            )
        else:
            st.warning("Path found but scan failed.")
    elif repo_path_clean:
        st.error("Directory not found.")

    # ── Already indexed? ───────────────────────────────────────────────────────
    is_indexed = repo_path_clean and os.path.isdir(repo_path_clean) and index_exists(repo_path_clean)
    is_active  = st.session_state.indexed_path == repo_path_clean and st.session_state.qa_chain is not None

    if is_active:
        st.markdown("<div class='status-badge badge-success'>✅ Indexed & Active</div>", unsafe_allow_html=True)
    elif is_indexed:
        st.markdown("<div class='status-badge badge-info'>💾 Index exists on disk</div>", unsafe_allow_html=True)
    elif repo_path_clean and os.path.isdir(repo_path_clean):
        st.markdown("<div class='status-badge badge-warning'>⏳ Not indexed yet</div>", unsafe_allow_html=True)

    st.markdown("")

    # ── Action buttons ─────────────────────────────────────────────────────────
    col_idx, col_load = st.columns(2)

    with col_idx:
        index_btn = st.button(
            "⚡ Index",
            disabled=not (repo_path_clean and os.path.isdir(repo_path_clean)),
            help="Scan, embed, and persist the codebase.",
            key="btn_index",
        )

    with col_load:
        load_btn = st.button(
            "📂 Load",
            disabled=not is_indexed,
            help="Load existing index without re-scanning.",
            key="btn_load",
        )

    if load_btn and is_indexed and not is_active:
        with st.spinner("Loading index…"):
            try:
                _load_chain_for_repo(repo_path_clean)
                st.success("Index loaded! Ask away.")
                st.rerun()
            except Exception as e:
                st.error(f"Load failed: {e}")

    # ── Provider Settings (collapsible) ───────────────────────────────────────
    with st.expander("⚙️ Provider Settings", expanded=not st.session_state.base_url):
        new_base_url = st.text_input(
            "Base URL",
            value=st.session_state.base_url,
            placeholder="https://api.your-provider.com/v1",
            help="Leave blank for official OpenAI. For third-party providers, paste their OpenAI-compatible base URL here.",
            key="input_base_url",
        )
        new_llm_model = st.text_input(
            "Chat model",
            value=st.session_state.llm_model,
            placeholder=f"Default: {__import__('config').LLM_MODEL}",
            help="Override the LLM model name (e.g. gpt-4o, claude-3-5-sonnet, etc.).",
            key="input_llm_model",
        )
        new_embed_model = st.text_input(
            "Embedding model",
            value=st.session_state.embedding_model,
            placeholder=f"Default: {__import__('config').EMBEDDING_MODEL}",
            help="Override the embedding model name.",
            key="input_embed_model",
        )
        if st.button("💾 Apply Settings", key="btn_apply_settings"):
            st.session_state.base_url = new_base_url.strip()
            st.session_state.llm_model = new_llm_model.strip()
            st.session_state.embedding_model = new_embed_model.strip()
            # Reset chain so next query uses new settings
            st.session_state.qa_chain = None
            st.rerun()

    # ── Clear conversation ─────────────────────────────────────────────────────
    st.divider()
    if st.button("🗑️ Clear Conversation", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    # ── Info ───────────────────────────────────────────────────────────────────
    st.divider()
    _active_llm   = st.session_state.llm_model or __import__('config').LLM_MODEL
    _active_embed = st.session_state.embedding_model or __import__('config').EMBEDDING_MODEL
    _active_base  = st.session_state.base_url or "api.openai.com (default)"
    st.markdown(f"""
<div style='color:#4a5568;font-size:0.74rem;line-height:1.7;'>
<b style='color:#718096;'>Supported:</b> .py .js .ts .html .css .java .cpp .c .go .rs .md<br>
<b style='color:#718096;'>LLM:</b> {_active_llm}<br>
<b style='color:#718096;'>Embeddings:</b> {_active_embed}<br>
<b style='color:#718096;'>Endpoint:</b> {_active_base}<br>
<b style='color:#718096;'>Store:</b> ChromaDB (local)
</div>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN AREA — Indexing trigger (runs here so progress shows in main area)
# ══════════════════════════════════════════════════════════════════════════════
progress_area = st.empty()

if index_btn and repo_path_clean and os.path.isdir(repo_path_clean):
    try:
        _build_chain_for_repo(repo_path_clean, progress_area)
        progress_area.success(f"🎉 **Codebase indexed!** You can now ask questions about `{repo_path_clean}`.")
        st.rerun()
    except ValueError as ve:
        progress_area.error(str(ve))
    except Exception as e:
        logger.exception("Indexing failed")
        progress_area.error(f"Indexing failed: {e}")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN AREA — Header
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("<div class='hero-title'>🔭 Talk-With-Repo</div>", unsafe_allow_html=True)
st.markdown("<div class='hero-sub'>Ask natural-language questions about any local codebase.</div>", unsafe_allow_html=True)

if st.session_state.indexed_path:
    st.markdown(
        f"<div class='status-badge badge-success' style='margin-bottom:1rem;'>"
        f"📂 {st.session_state.indexed_path}</div>",
        unsafe_allow_html=True,
    )

st.divider()


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN AREA — Welcome / Chat
# ══════════════════════════════════════════════════════════════════════════════
if st.session_state.qa_chain is None:
    # ── Welcome card ──────────────────────────────────────────────────────────
    st.markdown("""
<div class='welcome-card'>
    <div class='welcome-icon'>🧭</div>
    <div class='welcome-title'>Navigate Any Codebase with AI</div>
    <div class='welcome-text'>
        Paste your repository path in the sidebar, click <strong>Index</strong>,
        and start asking questions about architecture, dependencies, and logic flow.
    </div>
    <div class='example-queries'>
        <div class='query-chip'>💬 "What is the entry point of this application?"</div>
        <div class='query-chip'>💬 "Which file handles API payload validation?"</div>
        <div class='query-chip'>💬 "Show every function that imports from utils.js"</div>
        <div class='query-chip'>💬 "How does the authentication flow work?"</div>
        <div class='query-chip'>💬 "What design pattern is used for database access?"</div>
    </div>
</div>
""", unsafe_allow_html=True)

else:
    # ── Render existing messages ───────────────────────────────────────────────
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg["role"] == "assistant" and msg.get("sources"):
                with st.expander("📂 Inspected Files", expanded=False):
                    for src in msg["sources"]:
                        # Make path relative to indexed repo for readability
                        try:
                            rel = os.path.relpath(src, st.session_state.indexed_path)
                        except ValueError:
                            rel = src
                        st.markdown(
                            f"<code style='font-size:0.8rem;color:#63b3ed;'>{rel}</code>",
                            unsafe_allow_html=True,
                        )

    # ── Chat input ────────────────────────────────────────────────────────────
    if user_question := st.chat_input(
        "Ask anything about the codebase…",
        key="chat_input",
    ):
        # Append user message
        st.session_state.messages.append({"role": "user", "content": user_question, "sources": []})
        with st.chat_message("user"):
            st.markdown(user_question)

        # Generate response
        with st.chat_message("assistant"):
            with st.spinner("🔍 Searching codebase and reasoning…"):
                try:
                    answer, sources = query_codebase(st.session_state.qa_chain, user_question)
                except Exception as e:
                    logger.exception("Query failed")
                    answer = f"❌ Query failed: {e}"
                    sources = []

            st.markdown(answer)

            if sources:
                with st.expander("📂 Inspected Files", expanded=False):
                    for src in sources:
                        try:
                            rel = os.path.relpath(src, st.session_state.indexed_path)
                        except ValueError:
                            rel = src
                        st.markdown(
                            f"<code style='font-size:0.8rem;color:#63b3ed;'>{rel}</code>",
                            unsafe_allow_html=True,
                        )

        # Persist assistant message
        st.session_state.messages.append({
            "role": "assistant",
            "content": answer,
            "sources": sources,
        })
