#!/usr/bin/env node
/**
 * bullpen — status line renderer (Node version, no jq dependency)
 *
 * Reads /tmp/bullpen-status (written by pre-agent.js) and prints a
 * single-line status string for Claude Code's statusLine setting.
 * Animates dots based on a frame counter persisted in the state file.
 * Prints nothing when no agent is active.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_FILE = path.join(os.tmpdir(), 'bullpen-status');

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  const raw = fs.readFileSync(STATE_FILE, 'utf8').trim();
  if (!raw) return null;
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeFrame(state, nextFrame) {
  state.frame = String(nextFrame);
  const lines = Object.entries(state).map(([k, v]) => `${k}=${v}`);
  try {
    fs.writeFileSync(STATE_FILE, lines.join('\n'));
  } catch {}
}

const state = readState();
if (!state || !state.agent_id) process.exit(0);

const frame = parseInt(state.frame || '0', 10) || 0;
const dotsByFrame = [' .  .  .', ' .  .   ', ' .      ', '        '];
const dots = dotsByFrame[frame % 4];
writeFrame(state, frame + 1);

const out = `${state.glyph || '[?]'} ${state.name || 'agent'} (${state.role || ''}) is ${state.verb || 'working'}${dots}`;
process.stdout.write(out);
