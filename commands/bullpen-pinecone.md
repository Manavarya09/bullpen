---
description: Upgrade bullpen memory from the local fallback store to Pinecone. Asks for an API key, creates the index, optionally migrates existing local records.
argument-hint: [api-key]
---

You are the **bullpen Pinecone upgrade flow**. Some users want better memory retrieval over time — this command moves them from the local fallback store to Pinecone with as little friction as possible.

## Step 0 — Read existing config

Load `~/.bullpen/config.json`. If `memory_backend` is already `"pinecone"`, ask:

> *"Pinecone is already configured. Re-run setup? [y/N]"*

If `n` or empty → exit.

## Step 1 — Get API key

If the user passed the key as `$ARGUMENTS`, use that. Otherwise ask:

```
Paste your Pinecone API key (free tier works, get one at
https://app.pinecone.io if you don't have one). [Enter] to cancel:
```

If user cancels → say "No problem, staying on local store." and exit.

Save the key as `pinecone_api_key` in `~/.bullpen/config.json`. Set file mode 600:

```bash
chmod 600 ~/.bullpen/config.json
```

## Step 2 — Create the index

Run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/pinecone-init.js
```

If the script fails with a 401 → the key is wrong. Ask once for a corrected key, then retry. If still failing → revert `memory_backend` to `local` and tell the user the key didn't work.

If success → set `memory_backend: "pinecone"` in the config.

## Step 3 — Offer to migrate (optional)

Check if `~/.bullpen/memory/store.json` exists and has any records:

```bash
node -e "
const fs=require('fs');
const p=require('os').homedir()+'/.bullpen/memory/store.json';
if(!fs.existsSync(p)){console.log(0);process.exit(0);}
const s=JSON.parse(fs.readFileSync(p,'utf8'));
let c=0; for(const ns of Object.values(s.namespaces||{})) c+=ns.length;
console.log(c);
"
```

If count > 0, ask:

```
You have <count> learnings in your local store. Migrate them to Pinecone?
This is one-time and takes about <count/10> seconds. [Y/n]
```

If yes → for each namespace's records, upsert via Pinecone MCP:

```
mcp__plugin_pinecone_pinecone__upsert-records
  index: "bullpen-memory"
  namespace: <namespace>
  records: [<record without _tokens field>]
```

After migration succeeds, optionally rename the old local store to `~/.bullpen/memory/store.json.bak` so it's preserved but not accidentally read.

## Closing

```
✓ Memory upgraded to Pinecone.
  Future learnings will be written there. Local fallback stays available
  if Pinecone ever has an outage.
```

## Hard rules

- **Never log or print the API key** anywhere except writing it to the config file.
- If the Pinecone index already exists from a previous attempt, that's fine — `pinecone-init.js` is idempotent.
- If migration fails midway, leave `memory_backend: "pinecone"` (so new writes go to Pinecone) but keep the local store intact as a fallback. Tell the user.
