#!/usr/bin/env node
/**
 * bullpen — local fallback store
 *
 * Used when the user has no Pinecone API key. Provides upsert/search over
 * a JSON-backed file with naive token-overlap scoring (TF-IDF-lite) — good
 * enough for ≤10k records per namespace, fully offline, zero deps.
 *
 * Same record schema as Pinecone path:
 *   { id, text, type, agent_role, project_path, created_at, session_id, ref_files }
 *
 * Usage (CLI):
 *   node scripts/pinecone-fallback.js init
 *   node scripts/pinecone-fallback.js upsert <namespace> <json-record>
 *   node scripts/pinecone-fallback.js search <namespace> "<query>" [topK]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_DIR = path.join(os.homedir(), '.bullpen', 'memory');
const STORE_FILE = path.join(STORE_DIR, 'store.json');

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ namespaces: {} }, null, 2));
}

function loadStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
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
  // Length-normalize so very long records don't dominate
  return hits / Math.sqrt(recordTokens.length);
}

function upsert(namespace, record) {
  const store = loadStore();
  if (!store.namespaces[namespace]) store.namespaces[namespace] = [];
  const tokens = tokenize(record.text);
  store.namespaces[namespace].push({ ...record, _tokens: tokens });
  saveStore(store);
}

function search(namespace, query, topK = 5) {
  const store = loadStore();
  const records = store.namespaces[namespace] || [];
  if (!records.length) return [];
  const qt = tokenize(query);
  return records
    .map((r) => ({ record: r, score: score(qt, r._tokens || tokenize(r.text)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((m) => m.score > 0)
    .map((m) => {
      const { _tokens, ...clean } = m.record;
      return { ...clean, _score: Number(m.score.toFixed(4)) };
    });
}

function main() {
  const [, , cmd, ...args] = process.argv;
  if (cmd === 'init') {
    ensureStore();
    console.log(`✓ Local store initialized at ${STORE_FILE}`);
    return;
  }
  if (cmd === 'upsert') {
    const [namespace, json] = args;
    if (!namespace || !json) {
      console.error('Usage: upsert <namespace> <json-record>');
      process.exit(1);
    }
    upsert(namespace, JSON.parse(json));
    console.log('✓ Upserted.');
    return;
  }
  if (cmd === 'search') {
    const [namespace, query, k] = args;
    if (!namespace || !query) {
      console.error('Usage: search <namespace> "<query>" [topK]');
      process.exit(1);
    }
    const results = search(namespace, query, k ? Number(k) : 5);
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.error('Commands: init | upsert <ns> <json> | search <ns> <query> [topK]');
  process.exit(1);
}

if (require.main === module) main();

module.exports = { upsert, search, ensureStore, STORE_FILE };
