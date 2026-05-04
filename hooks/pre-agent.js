#!/usr/bin/env node
/**
 * bullpen — pre-agent hook (Node version, no jq dependency)
 *
 * Reads tool-call JSON from stdin, looks up the matching teammate in
 * roster.json, prints an ASCII activation card to stderr (visible in
 * terminal, NOT injected into LLM context), and writes the status state
 * file the status-line script reads.
 *
 * Zero LLM cost — entirely local rendering.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const ROSTER_PATH = path.join(ROOT, 'scripts', 'roster.json');
const STATE_FILE = path.join(os.tmpdir(), 'bullpen-status');
const CONFIG_FILE = path.join(os.homedir(), '.bullpen', 'config.json');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    // If no stdin within 200ms, exit gracefully
    setTimeout(() => resolve(data), 200);
  });
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const raw = await readStdin();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  let agentId =
    payload?.tool_input?.subagent_type || payload?.tool_input?.agent || null;
  if (!agentId) process.exit(0);

  // Strip plugin-namespace prefix if present (e.g., "bullpen:ui-designer" → "ui-designer")
  if (agentId.includes(':')) agentId = agentId.split(':').pop();

  const roster = safeReadJson(ROSTER_PATH);
  if (!roster?.agents) process.exit(0);

  const agent = roster.agents.find((a) => a.id === agentId);
  if (!agent) process.exit(0);

  // Honor persona preference + per-user persona overrides
  const cfg = safeReadJson(CONFIG_FILE) || {};
  const personasOff = cfg.personas === 'off';
  const overrideName = cfg.persona_names?.[agent.id];
  const displayName = personasOff ? agent.role : (overrideName || agent.name);

  // Memory loop: query relevant past learnings and write to a context file
  // the agent will Read at the start of the task. Off unless config.learning === 'on'.
  if (cfg.learning === 'on') {
    try {
      const taskQuery =
        payload?.tool_input?.prompt ||
        payload?.tool_input?.description ||
        payload?.tool_input?.task ||
        '';
      if (taskQuery) {
        const { search } = require(path.join(ROOT, 'scripts', 'memory.js'));
        const projectPath = process.cwd();
        const memories = await search(agent.id, taskQuery, 5);
        const ctxPath = path.join(os.tmpdir(), `bullpen-memory-${agent.id}.md`);
        if (memories?.length) {
          const lines = memories
            .filter((m) => !m.project_path || m.project_path === projectPath || m.agent_role === agent.id)
            .slice(0, 5)
            .map((m) => `- [${m.type || 'note'}] ${m.text} (${m.created_at || 'unknown'})`);
          if (lines.length) {
            fs.writeFileSync(
              ctxPath,
              `# Past learnings for ${agent.name} (${agent.role})\n\nRelevant context from past sessions:\n\n${lines.join('\n')}\n`
            );
          } else {
            fs.writeFileSync(ctxPath, '');
          }
        } else {
          fs.writeFileSync(ctxPath, '');
        }
      }
    } catch {
      // never fail the agent over memory issues
    }
  }

  const action = `${agent.verb || 'working'}…`;

  // ASCII activation card → stderr
  const lines = [
    '',
    '   ╔══════════════════════════╗',
    '   ║   ▄▀▀▀▀▄                 ║',
    `   ║   █ ◉ ◉ █   ${pad(displayName, 13)}║`,
    `   ║   ▀▄▄▄▄▀   ${pad(agent.role, 14)}║`,
    `   ║   ${pad(action, 22)} ║`,
    '   ╚══════════════════════════╝',
    '',
  ];
  process.stderr.write(lines.join('\n') + '\n');

  // Write state file for status-line script
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const state = [
      `agent_id=${agent.id}`,
      `name=${displayName}`,
      `role=${agent.role}`,
      `glyph=${agent.glyph}`,
      `verb=${agent.verb || 'working'}`,
      `started_at=${Math.floor(Date.now() / 1000)}`,
      'frame=0',
    ].join('\n');
    fs.writeFileSync(STATE_FILE, state);
  } catch {
    // best-effort; don't fail the tool call over a state-file write
  }
}

function pad(s, n) {
  s = String(s || '');
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

main().catch(() => process.exit(0));
