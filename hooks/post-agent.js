#!/usr/bin/env node
/**
 * bullpen — post-agent hook (Node version, no jq dependency)
 *
 * Clears the status-line state, appends a one-line wellness ledger
 * entry, enqueues a learning-extraction job for the matching Intern,
 * and emits one-time contextual nudges (Pip / Sage / naming) to
 * stderr at the right task counts.
 *
 * The nudges replace the old onboarding wizard — progressive
 * disclosure beats a five-question setup.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'bullpen-status');
const COACH_FILE = path.join(os.tmpdir(), 'bullpen-coach');
const LEARN_QUEUE = path.join(os.tmpdir(), 'bullpen-learn-queue');
const CONFIG_FILE = path.join(os.homedir(), '.bullpen', 'config.json');

const NUDGES = {
  learning: {
    threshold: 1,
    flag: 'learning_asked',
    line:
      "(•) Sprout waves: Hey, I'm Sprout — one of your interns. Wanna let me start writing down what your team learns? Memory gets sharper every session. Try `/bullpen-learning on`.",
  },
  coach: {
    threshold: 3,
    flag: 'coach_asked',
    line:
      "(♡) Sage says: Hi, I'm Sage. Want me checking in on you sometimes — celebrate wins, remind you to rest? Run `/bullpen-coach on` to switch me on.",
  },
  naming: {
    threshold: 5,
    flag: 'naming_asked',
    line:
      "✨ Your team has default names (Atlas, Rune, Forge, Bastion, Sage…). Want to rename anyone? `/bullpen-name`. Or skip — they're fine as-is.",
  },
};

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

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    try {
      fs.chmodSync(CONFIG_FILE, 0o600);
    } catch {}
  } catch {}
}

function extractLearningText(payload) {
  // Tool response shape varies. Walk common paths to find a text body.
  const candidates = [
    payload?.tool_response?.content?.[0]?.text,
    payload?.tool_response?.text,
    payload?.tool_response?.output,
    payload?.tool_response?.result,
    typeof payload?.tool_response === 'string' ? payload.tool_response : null,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 50) {
      // Truncate to a manageable size for the snippet record
      return c.trim().slice(0, 1500);
    }
  }
  return null;
}

function maybePrintNudge(cfg) {
  if (!cfg) return;
  const taskCount = cfg.task_count || 0;
  // Pick the first nudge whose threshold has been hit and flag is still false.
  // Only one nudge per task call so we never spam.
  for (const key of ['learning', 'coach', 'naming']) {
    const n = NUDGES[key];
    if (!cfg[n.flag] && taskCount >= n.threshold) {
      process.stderr.write(`\n   ${n.line}\n\n`);
      cfg[n.flag] = true;
      writeConfig(cfg);
      return;
    }
  }
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

  const now = Math.floor(Date.now() / 1000);
  let status = 'ok';
  const isError = payload?.tool_response?.is_error;
  if (typeof isError === 'boolean') status = isError ? 'error' : 'ok';
  else if (payload?.tool_response === undefined) status = 'unknown';

  // Wellness ledger (last 20 lines)
  try {
    fs.mkdirSync(path.dirname(COACH_FILE), { recursive: true });
    const prev = fs.existsSync(COACH_FILE)
      ? fs.readFileSync(COACH_FILE, 'utf8').split('\n').filter(Boolean)
      : [];
    prev.push(`ts=${now} agent=${agentId || 'unknown'} status=${status}`);
    fs.writeFileSync(COACH_FILE, prev.slice(-20).join('\n') + '\n');
  } catch {}

  // Memory write: store the task as a snippet record so future runs of
  // the same agent can recall this work via bullpen-memory.
  const cfg = readConfig();
  if (agentId && status === 'ok' && cfg?.learning === 'on') {
    try {
      fs.appendFileSync(LEARN_QUEUE, `${agentId}|${now}|${status}\n`);
      const text = extractLearningText(payload);
      if (text) {
        const ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
        const { upsert } = require(path.join(ROOT, 'scripts', 'memory.js'));
        const record = {
          id: `${agentId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
          text,
          type: 'snippet',
          agent_role: agentId,
          project_path: process.cwd(),
          created_at: new Date(now * 1000).toISOString(),
          session_id: state.started_at || String(now),
          ref_files: '',
        };
        await upsert(agentId, record);
      }
    } catch {
      // never fail the user over a memory write
    }
  }

  // Increment task counter and print contextual nudge
  if (cfg && agentId && status !== 'unknown') {
    cfg.task_count = (cfg.task_count || 0) + 1;
    writeConfig(cfg);
    maybePrintNudge(cfg);
  }
}

main().catch(() => process.exit(0));
