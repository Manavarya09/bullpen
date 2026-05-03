#!/usr/bin/env node
/**
 * bullpen — post-agent hook (Node version, no jq dependency)
 *
 * Clears the status-line state, appends a one-line wellness ledger
 * entry (last 20 kept), and enqueues a learning-extraction job for
 * the matching Intern.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'bullpen-status');
const COACH_FILE = path.join(os.tmpdir(), 'bullpen-coach');
const LEARN_QUEUE = path.join(os.tmpdir(), 'bullpen-learn-queue');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 200);
  });
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(STATE_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const raw = await readStdin();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    /* tolerate */
  }

  const state = readState();
  const agentId = state.agent_id;

  // Clear status state
  try {
    fs.writeFileSync(STATE_FILE, '');
  } catch {}

  // Append wellness ledger entry
  const now = Math.floor(Date.now() / 1000);
  let status = 'unknown';
  const isError = payload?.tool_response?.is_error;
  if (typeof isError === 'boolean') status = isError ? 'error' : 'ok';

  try {
    fs.mkdirSync(path.dirname(COACH_FILE), { recursive: true });
    const prev = fs.existsSync(COACH_FILE)
      ? fs.readFileSync(COACH_FILE, 'utf8').split('\n').filter(Boolean)
      : [];
    prev.push(`ts=${now} agent=${agentId || 'unknown'} status=${status}`);
    fs.writeFileSync(COACH_FILE, prev.slice(-20).join('\n') + '\n');
  } catch {}

  // Enqueue learning extraction for Intern
  if (agentId) {
    try {
      fs.appendFileSync(LEARN_QUEUE, `${agentId}|${now}|${status}\n`);
    } catch {}
  }
}

main().catch(() => process.exit(0));
