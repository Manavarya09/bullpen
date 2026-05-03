---
name: bullpen-memory
description: Use this skill before any bullpen agent runs to retrieve relevant past learnings from Pinecone (or the local SQLite-style fallback). Trigger when an agent activates and needs context from prior sessions — preferences, decisions, patterns, failures, or code snippets stored in their namespace. Keep the memory block under 1KB so it fits cleanly in the agent's prompt.
---

# bullpen-memory

This skill retrieves the top relevant past learnings for the active bullpen agent and injects them as a `<bullpen-memory>` block in the agent's working context.

## When to use

Invoke automatically as the first step of any bullpen agent's task. Skip if the agent is one of the five Interns (they're the writers, not the readers).

## Inputs you'll have

- `agent_role` — the agent's `id` field from `roster.json` (e.g., `ui-designer`)
- `task_summary` — a short string describing what the user is asking for
- `project_path` — absolute path of the current working directory

## How to retrieve

### Path A — Pinecone is available

If `${HOME}/.bullpen/config.json` has `pinecone_api_key` set AND the Pinecone MCP plugin is installed, use these MCP tools (in order):

1. **Search the role's namespace first**, scoped to `project_path`:
   ```
   mcp__plugin_pinecone_pinecone__search-records
     index: "bullpen-memory"
     namespace: <agent_role>
     query: <task_summary>
     topK: 5
     filter: { project_path: { "$eq": <project_path> } }
   ```
2. If fewer than 3 results returned, **search again without the filter** to widen scope to all of the role's history.
3. If still fewer than 3, **search the `bullpen-shared` namespace** with the same query and topK 3.

### Path B — Local fallback

If Pinecone isn't configured, run the bundled fallback script:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/pinecone-fallback.js search <agent_role> "<task_summary>" 5
```

The script returns the same record shape, scored by token overlap.

## How to inject

Format the top results as a compact block prepended to the agent's instructions:

```
<bullpen-memory role="<agent_role>">
- [decision] User chose Postgres over MySQL because they need JSONB (2026-04-12)
- [pattern] This codebase uses `useFormHook` for all forms (2026-04-08)
- [preference] User prefers Tailwind over CSS modules (2026-03-30)
</bullpen-memory>
```

**Rules:**

- Sort by score descending, take at most 5.
- One bullet per record: `- [<type>] <text> (<created_at>)`
- Strip duplicates by `text` similarity (don't show two near-identical learnings).
- Skip silently if no results — don't inject an empty block.
- Total memory block must be ≤1KB. If retrieved content is larger, drop the lowest-scored items first.

## Failure modes

- Pinecone unreachable mid-session → fall back to local store transparently. Don't block the agent.
- No memories at all → that's fine. The agent runs without context. The Intern will start filling the namespace after the task.
