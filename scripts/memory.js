#!/usr/bin/env node
/**
 * bullpen — memory module
 *
 * Per-project local memory. No daemons. No accounts. No databases.
 * Just a JSON file at <project_root>/.bullpen/memory.json that grows
 * as the team learns. Auto-gitignored on first write.
 *
 * Memory follows the project — clone the repo on another machine and
 * the team's accumulated wisdom comes with you. Optionally commit
 * `.bullpen/memory.json` to share learnings across the team.
 *
 * Importable from hooks; also runnable as a CLI for debugging.
 */

const fs = require('fs');
const path = require('path');

const STORE_FILENAME = 'memory.json';
const STORE_DIR = '.bullpen';

function findProjectRoot(startDir = process.cwd()) {
  // Walk up looking for a .git directory; stop at filesystem root.
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: cwd. Single-file projects without git still get memory.
  return path.resolve(startDir);
}

function storePath() {
  const root = findProjectRoot();
  return path.join(root, STORE_DIR, STORE_FILENAME);
}

function ensureGitignore() {
  // Append `.bullpen/` to the project's .gitignore if it isn't already
  // there. Memory is private by default — users can opt in to committing
  // by removing the line. We only touch .gitignore if .git exists.
  const root = findProjectRoot();
  if (!fs.existsSync(path.join(root, '.git'))) return;
  const giPath = path.join(root, '.gitignore');
  let lines = [];
  if (fs.existsSync(giPath)) {
    lines = fs.readFileSync(giPath, 'utf8').split('\n');
    if (lines.some((l) => l.trim() === '.bullpen/' || l.trim() === '.bullpen')) return;
  }
  const newContent =
    (lines.length ? lines.join('\n').replace(/\n*$/, '\n\n') : '') +
    '# bullpen — per-project AI memory (uncomment to share with the team)\n.bullpen/\n';
  try {
    fs.writeFileSync(giPath, newContent);
  } catch {
    // best-effort; if gitignore is read-only or anything weird, skip silently
  }
}

function loadStore() {
  const p = storePath();
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ namespaces: {} }, null, 2));
    ensureGitignore();
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { namespaces: {} };
  }
}

function saveStore(store) {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2));
  ensureGitignore();
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function score(queryTokens, recordTokens) {
  if (!queryTokens.length || !recordTokens.length) return 0;
  const recSet = new Set(recordTokens);
  let hits = 0;
  for (const t of queryTokens) if (recSet.has(t)) hits++;
  return hits / Math.sqrt(recordTokens.length);
}

async function upsert(namespace, record) {
  const store = loadStore();
  if (!store.namespaces[namespace]) store.namespaces[namespace] = [];
  const tokens = tokenize(record.text);
  store.namespaces[namespace].push({ ...record, _tokens: tokens });
  saveStore(store);
}

async function search(namespace, query, topK = 5) {
  const store = loadStore();
  const records = store.namespaces[namespace] || [];
  if (!records.length) return [];
  const qt = tokenize(query);
  return records
    .map((r) => ({ record: r, score: score(qt, r._tokens || tokenize(r.text)) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((m) => {
      const { _tokens, ...clean } = m.record;
      return { ...clean, _score: Number(m.score.toFixed(4)) };
    });
}

if (require.main === module) {
  (async () => {
    const [, , cmd, ...args] = process.argv;
    if (cmd === 'init') {
      loadStore();
      console.log(`✓ Memory store initialized at ${storePath()}`);
    } else if (cmd === 'search') {
      const [ns, q, k] = args;
      if (!ns || !q) {
        console.error('Usage: search <namespace> "<query>" [topK]');
        process.exit(1);
      }
      const r = await search(ns, q, k ? Number(k) : 5);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'upsert') {
      const [ns, json] = args;
      if (!ns || !json) {
        console.error('Usage: upsert <namespace> <json>');
        process.exit(1);
      }
      await upsert(ns, JSON.parse(json));
      console.log('✓');
    } else if (cmd === 'where') {
      console.log(storePath());
    } else {
      console.error('Commands: init | search <ns> <q> [k] | upsert <ns> <json> | where');
      process.exit(1);
    }
  })().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { search, upsert, findProjectRoot, storePath };
