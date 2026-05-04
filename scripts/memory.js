#!/usr/bin/env node
/**
 * bullpen — memory module
 *
 * Single API for read/write that auto-detects the backend (Pinecone if
 * config has pinecone_api_key + memory_backend "pinecone", otherwise
 * the local JSON store via pinecone-fallback.js).
 *
 * Importable from hooks; also runnable as a CLI for debugging.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { upsert: localUpsert, search: localSearch } = require('./pinecone-fallback.js');

const CONFIG_FILE = path.join(os.homedir(), '.bullpen', 'config.json');
const PINECONE_INDEX = 'bullpen-memory';

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function pineconeRequest(apiKey, host, pathname, body) {
  const url = `https://${host}${pathname}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-01',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pinecone ${pathname} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function getPineconeHost(apiKey) {
  const res = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX}`, {
    headers: { 'Api-Key': apiKey, 'X-Pinecone-API-Version': '2025-01' },
  });
  if (!res.ok) throw new Error(`Index lookup failed: ${res.status}`);
  const data = await res.json();
  return data.host;
}

async function pineconeSearch(apiKey, namespace, query, topK, filter) {
  const host = await getPineconeHost(apiKey);
  const body = {
    query: { topK, inputs: { text: query } },
  };
  if (filter) body.query.filter = filter;
  const data = await pineconeRequest(apiKey, host, `/records/namespaces/${encodeURIComponent(namespace)}/search`, body);
  return (data?.result?.hits || []).map((h) => ({
    ...h.fields,
    _score: h._score,
  }));
}

async function pineconeUpsert(apiKey, namespace, records) {
  const host = await getPineconeHost(apiKey);
  await pineconeRequest(apiKey, host, `/records/namespaces/${encodeURIComponent(namespace)}/upsert`, { records });
}

async function search(namespace, query, topK = 5, filter = null) {
  const cfg = readConfig() || {};
  if (cfg.memory_backend === 'pinecone' && cfg.pinecone_api_key) {
    try {
      return await pineconeSearch(cfg.pinecone_api_key, namespace, query, topK, filter);
    } catch (e) {
      // fall through to local
    }
  }
  return localSearch(namespace, query, topK);
}

async function upsert(namespace, record) {
  const cfg = readConfig() || {};
  if (cfg.memory_backend === 'pinecone' && cfg.pinecone_api_key) {
    try {
      await pineconeUpsert(cfg.pinecone_api_key, namespace, [record]);
      return;
    } catch (e) {
      // fall through to local
    }
  }
  localUpsert(namespace, record);
}

if (require.main === module) {
  (async () => {
    const [, , cmd, ...args] = process.argv;
    if (cmd === 'search') {
      const [ns, q, k] = args;
      const r = await search(ns, q, k ? Number(k) : 5);
      console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'upsert') {
      const [ns, json] = args;
      await upsert(ns, JSON.parse(json));
      console.log('✓');
    } else {
      console.error('Usage: search <ns> <q> [k] | upsert <ns> <json>');
      process.exit(1);
    }
  })().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { search, upsert };
