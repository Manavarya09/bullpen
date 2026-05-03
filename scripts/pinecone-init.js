#!/usr/bin/env node
/**
 * bullpen — Pinecone bootstrap
 *
 * Creates the `bullpen-memory` index using Pinecone's hosted embedding model
 * (multilingual-e5-large, 1024-dim). Namespaces are not pre-created — they
 * appear implicitly on first upsert per agent role.
 *
 * Usage:
 *   PINECONE_API_KEY=... node scripts/pinecone-init.js
 *
 * Or read the key from ~/.bullpen/config.json (written by /bullpen-init).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const INDEX_NAME = 'bullpen-memory';
const MODEL = 'multilingual-e5-large';
const FIELD_MAP = { text: 'text' };
const CONFIG_PATH = path.join(os.homedir(), '.bullpen', 'config.json');

function readApiKey() {
  if (process.env.PINECONE_API_KEY) return process.env.PINECONE_API_KEY;
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return cfg.pinecone_api_key;
    } catch (e) {
      // ignore parse errors — fall through
    }
  }
  return null;
}

async function api(apiKey, pathname, init = {}) {
  const res = await fetch(`https://api.pinecone.io${pathname}`, {
    ...init,
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2025-01',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Pinecone ${init.method || 'GET'} ${pathname} → ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

async function indexExists(apiKey) {
  const data = await api(apiKey, '/indexes');
  return (data.indexes || []).some((i) => i.name === INDEX_NAME);
}

async function createIndex(apiKey) {
  await api(apiKey, '/indexes/create-for-model', {
    method: 'POST',
    body: JSON.stringify({
      name: INDEX_NAME,
      cloud: 'aws',
      region: 'us-east-1',
      embed: {
        model: MODEL,
        field_map: FIELD_MAP,
      },
    }),
  });
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error('No Pinecone API key. Set PINECONE_API_KEY or run /bullpen-init.');
    process.exit(1);
  }

  if (await indexExists(apiKey)) {
    console.log(`✓ Index "${INDEX_NAME}" already exists. Skipping creation.`);
    return;
  }

  console.log(`Creating index "${INDEX_NAME}" with model "${MODEL}"…`);
  await createIndex(apiKey);
  console.log('✓ Index created. Namespaces will appear on first upsert per role.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
