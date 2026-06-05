# Talk-With-Repo 🌌

Talk-With-Repo is an AI-powered Codebase Navigator that allows you to ask natural-language questions about any local code repository. Powered by a highly optimized RAG (Retrieval-Augmented Generation) pipeline, it reads your local files, understands codebase architecture, and gives precise, context-aware answers.

## 🚀 Features
- **Lightning-Fast Local Embeddings**: Bypasses slow API rate limits by running embeddings entirely locally on CPU/GPU.
- **Smart AST-Based Code Chunking**: Intelligently keeps functions and classes together instead of blindly chopping lines in half.
- **Persistent Vector Stores**: Indexes repositories once and caches the ChromaDB vector store for instant future loads.
- **Interactive UI**: A sleek, modern React frontend to seamlessly interact with your codebase.

---

## 🏗️ Project Structure

The repository is built on a hybrid architecture, decoupling the UI/Server from the heavy machine-learning RAG pipeline using a persistent stdio bridge.

```text
Talk-With-Repo/
├── client/                 # React Frontend (Vite)
│   ├── src/                # UI Components, Pages, and Hooks
│   └── index.html          # Entry HTML
├── server/                 # Node.js Express Backend
│   ├── index.js            # Express API Server
│   ├── routes/             # API routes handling frontend requests
│   └── python_bridge.js    # Child process manager communicating with Python
├── src/                    # Python RAG Engine
│   ├── engine.py           # Vector storage, retrieval, and QA chain logic
│   └── ingester.py         # File scanning, language-aware parsing, chunking
├── bridge.py               # Persistent JSON-over-stdio bridge linking Node to Python
├── config.py               # RAG settings (Chunk sizes, models, excluded files)
└── .env                    # Environment variables and API keys
```

---

## 🛠️ Tech Stack

### Frontend
- **React.js** (via Vite)
- **Vanilla CSS** (Vibrant, modern dark-mode aesthetic)

### Backend
- **Node.js & Express**: Handles API routing and manages the Python child process.
- **Python**: Core data processing, RAG, and LLM interaction.

### AI & RAG Pipeline
- **LangChain**: Orchestration of document loaders, splitters, and QA chains.
- **ChromaDB**: Fast, persistent local vector database.
- **HuggingFace Sentence-Transformers**: `all-MiniLM-L6-v2` for blazing fast, rate-limit-free local embeddings.
- **LiteLLM / OpenAI API**: `gpt-4o-mini` for cost-efficient, high-quality Chat/QA generation.
- **Esprima & pathspec**: For smart JS/TS abstract syntax tree (AST) parsing and accurate file exclusion filtering.

---

## 🔄 RAG Pipeline Workflow

When you type a repository path and hit **Index**, the following Retrieval-Augmented Generation pipeline is executed:

1. **Filtering & Discovery** (`ingester.py`): The ingester crawls the local directory, strictly respecting `config.EXCLUDED_PATTERNS` via `pathspec` to ignore noise like `node_modules`, `venv`, and `.env` files.
2. **Syntax-Aware Chunking** (`ingester.py`): Using LangChain's `LanguageParser` (backed by `esprima` for JavaScript/TypeScript), code files are split contextually at class and function boundaries rather than arbitrary character counts.
3. **Local Embedding** (`engine.py`): The chunked documents are passed to `HuggingFaceEmbeddings` (`all-MiniLM-L6-v2`). Processing locally avoids API rate limits (like OpenAI's 1000 TPM cap), turning a 5-minute indexing job into a 3-second task.
4. **Vector Storage** (`engine.py`): The embeddings are persisted into an isolated ChromaDB directory hashed to your specific repository path.
5. **Retrieval & Generation** (`bridge.py`): When a question is asked, the `RetrievalQA` chain fetches the top-K most relevant code chunks from ChromaDB. These chunks are injected into a prompt and sent to the LLM (`gpt-4o-mini`) to generate a precise answer with citations.

---

## ⚙️ How It Works (The Bridge)
Since Python handles ML libraries much better than Node.js, and Node.js handles web servers better than Python, this project uses a **Persistent Python Bridge**. 

Instead of booting a heavy Python script for every API request, the Node.js server spawns `bridge.py` as a persistent child process once. Node.js sends JSON commands via `stdin`, and Python streams back progress and results via `stdout`. This allows the massive LangChain/Chroma environment to stay warm and loaded in memory, ensuring instantaneous chat responses.

---

## 💻 Installation & Running Locally

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/Talk-With-Repo.git
cd Talk-With-Repo
```

### 2. Install Python Dependencies
```bash
# It is recommended to use a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install required packages
pip install -r requirements.txt

# Install optional packages for better parsing/embeddings
pip install esprima sentence-transformers langchain-huggingface
```

### 3. Install Node.js Dependencies
```bash
# Install root (concurrently) dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 4. Setup Environment Variables
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=your_base_url
```
*(Optionally override models or base URLs in the `.env` file as needed).*

### 5. Start the Application
Run the root `dev` script which uses `concurrently` to boot both the React frontend and Node/Python backend simultaneously:
```bash
npm run dev
```

The application will be running at **http://localhost:3000**!

mermaid
flowchart TD
  A["Run npm run dev"] --> B["Start Node Express server on port 3001"]
  A --> C["Start Vite React client on port 3000"]

  B --> D["Load server/python_bridge.js"]
  D --> E["Start bridge.py as persistent Python process"]
  E --> F["Python waits for JSON commands"]

  C --> G["User opens /app"]
  G --> H["useAppState calls /api/repo/status"]
  G --> I["User enters repository path"]

  I --> J["GET /api/repo/scan"]
  I --> K["GET /api/repo/index-exists"]
  J --> L["Sidebar shows file summary"]
  K --> L

  L --> M["User clicks Index"]
  M --> N["POST /api/repo/index"]
  N --> O["Node sends index command to Python"]
  O --> P["bridge.py runs cmd_index"]
  P --> Q["ingester.py scans files"]
  Q --> R["ingester.py splits files into chunks"]
  R --> S["engine.py creates embeddings"]
  S --> T["ChromaDB stores vector index"]
  T --> U["engine.py creates QA chain"]
  U --> V["Repository is active in memory"]

  V --> W["User asks a question"]
  W --> X["POST /api/chat/query"]
  X --> Y["Node sends query command to Python"]
  Y --> Z["bridge.py runs cmd_query"]
  Z --> AA["Retriever finds relevant code chunks"]
  AA --> AB["LLM generates answer from retrieved context"]
  AB --> AC["React renders markdown answer and source files"]