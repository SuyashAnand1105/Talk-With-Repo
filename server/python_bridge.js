/**
 * python_bridge.js — Manages the persistent Python bridge process.
 *
 * Spawns bridge.py exactly once at server startup. All RAG commands are
 * serialised through a FIFO queue (one in-flight request at a time) so the
 * Python GIL is never contested and line-buffered stdout stays predictable.
 *
 * For streaming commands (e.g. "index") the caller supplies an `onProgress`
 * callback that is invoked for each intermediate progress line before the
 * final done/error response.
 *
 * Crash recovery: if the bridge exits unexpectedly, the active request is
 * rejected and the process is restarted after 1 second. In-memory state
 * (qa_chain) will be lost, so the client must re-load the repo.
 */

const { spawn }  = require('child_process');
const readline   = require('readline');
const path       = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── State ──────────────────────────────────────────────────────────────────────
let proc    = null;
let rl      = null;
let ready   = false;

/** @type {Array<{cmd:object, resolve:Function, reject:Function, onProgress:Function|null}>} */
const queue = [];

/** @type {{cmd:object, resolve:Function, reject:Function, onProgress:Function|null}|null} */
let active  = null;


// ── Process lifecycle ──────────────────────────────────────────────────────────

function startBridge() {
  console.log('[bridge] Starting Python bridge process…');

  proc = spawn('python', ['bridge.py'], {
    cwd:   PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  rl.on('line', onLine);

  proc.stderr.on('data', (chunk) => {
    process.stderr.write(`[bridge:py] ${chunk}`);
  });

  proc.on('exit', (code, signal) => {
    console.error(`[bridge] Bridge exited (code=${code}, signal=${signal}). Restarting in 1 s…`);
    ready = false;
    rl?.close();
    proc = null;

    if (active) {
      active.reject(new Error('Python bridge crashed unexpectedly. Please re-load your repository.'));
      active = null;
    }

    setTimeout(startBridge, 1000);
  });
}

function onLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error('[bridge] Non-JSON stdout line:', line);
    return;
  }

  // ── Ready signal ────────────────────────────────────────────────────────────
  if (msg.type === 'ready') {
    ready = true;
    console.log('[bridge] Python bridge is ready.');
    drainQueue();
    return;
  }

  if (!active) {
    console.error('[bridge] Received message with no active request:', msg);
    return;
  }

  if (msg.type === 'progress') {
    // Streaming progress — stay active, more lines expected
    active.onProgress?.(msg.message);

  } else if (msg.type === 'done') {
    const { resolve } = active;
    active = null;
    resolve(msg.data ?? {});
    drainQueue();

  } else if (msg.type === 'error') {
    const { reject } = active;
    active = null;
    reject(new Error(msg.message ?? 'Unknown bridge error'));
    drainQueue();
  }
}

function drainQueue() {
  if (!ready || active || queue.length === 0) return;
  active = queue.shift();
  proc.stdin.write(JSON.stringify(active.cmd) + '\n');
}


// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Enqueue a command and return a Promise that resolves with the response data.
 *
 * @param {object}        cmd        - Command payload (must include `cmd` field).
 * @param {Function|null} onProgress - Optional callback for progress messages.
 * @returns {Promise<object>}
 */
function sendCommand(cmd, onProgress = null) {
  return new Promise((resolve, reject) => {
    queue.push({ cmd, resolve, reject, onProgress });
    drainQueue();
  });
}

// Boot immediately when this module is loaded
startBridge();

module.exports = { sendCommand };
