#!/usr/bin/env node
/**
 * bullpen — preflight check
 *
 * Validates the runtime: Node version, write access to ~/.bullpen and
 * tmpdir, presence of roster.json. Prints exactly one helpful line if
 * something's wrong, exits 0 if all good.
 *
 * Run as part of /bullpen-init and on demand via /bullpen-config preflight.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const checks = [];

function ok(label) {
  checks.push({ ok: true, label });
}
function fail(label, hint) {
  checks.push({ ok: false, label, hint });
}

// 1. Node version
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) fail(`Node ${process.versions.node}`, 'bullpen needs Node ≥ 18 (for global fetch). Upgrade with `brew install node` or nvm.');
else ok(`Node ${process.versions.node}`);

// 2. roster.json
const rosterPath = path.join(ROOT, 'scripts', 'roster.json');
if (!fs.existsSync(rosterPath)) fail('roster.json missing', `Reinstall the plugin or check $CLAUDE_PLUGIN_ROOT (currently: ${ROOT}).`);
else ok('roster.json present');

// 3. ~/.bullpen writable
try {
  const dir = path.join(os.homedir(), '.bullpen');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.preflight'), 'ok');
  fs.unlinkSync(path.join(dir, '.preflight'));
  ok('~/.bullpen writable');
} catch (e) {
  fail('~/.bullpen not writable', `${e.message}. Try \`chmod u+w ~ && mkdir -p ~/.bullpen\`.`);
}

// 4. tmpdir writable
try {
  const f = path.join(os.tmpdir(), `.bullpen-preflight-${process.pid}`);
  fs.writeFileSync(f, 'ok');
  fs.unlinkSync(f);
  ok('tmpdir writable');
} catch (e) {
  fail('tmpdir not writable', `${e.message}. Set TMPDIR to a writable path.`);
}

// Output
const allGood = checks.every((c) => c.ok);
for (const c of checks) {
  process.stdout.write(`${c.ok ? '✓' : '✗'} ${c.label}${c.hint ? `\n   → ${c.hint}` : ''}\n`);
}

if (!allGood) process.exit(1);
