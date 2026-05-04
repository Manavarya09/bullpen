---
name: bullpen-memory
description: Use this skill before any bullpen agent runs to retrieve relevant past learnings from the project's local memory store. Trigger when an agent activates and needs context from prior sessions — preferences, decisions, patterns, failures, or code snippets stored in their namespace. Memory lives in `<project>/.bullpen/memory.json` — per-project, plain JSON, no daemons.
---

# bullpen-memory

This skill retrieves the top relevant past learnings for the active bullpen agent and injects them as a `<bullpen-memory>` block in the agent's working context.

## When to use

Invoke automatically as the first step of any bullpen agent's task. Skip if the agent is one of the five Interns (they're the writers, not the readers).

## Inputs you'll have

- `agent_role` — the agent's `id` field from `roster.json` (e.g., `ui-designer`)
- `task_summary` — a short string describing what the user is asking for

## Where memory lives

```
<project root>/.bullpen/memory.json
```

The "project root" is the nearest ancestor directory containing `.git` (falls back to current working directory if no git repo). Memory is per-project — different projects = different memory. Auto-`.gitignore`'d on first write so it never accidentally enters commits unless the user explicitly opts in.

## How to retrieve

Run the bundled memory script from the project working directory:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/memory.js search <agent_role> "<task_summary>" 5
```

The script returns up to 5 records ranked by token-overlap relevance, in this shape:

```json
[
  { "id": "...", "text": "...", "type": "snippet", "agent_role": "ui-designer", "project_path": "...", "created_at": "...", "_score": 0.4 },
  ...
]
```

## How to inject

Format the top results as a compact block prepended to the agent's instructions:

```
<bullpen-memory role="ui-designer">
- [snippet] User prefers Tailwind over CSS modules; default to it (2026-04-12)
- [pattern] This codebase uses `useFormHook` for all forms (2026-04-08)
- [decision] User chose Postgres over MySQL because they need JSONB (2026-03-30)
</bullpen-memory>
```

**Rules:**

- Sort by `_score` descending, take at most 5.
- One bullet per record: `- [<type>] <text> (<created_at>)`
- Strip duplicates by `text` similarity (don't show two near-identical learnings).
- Skip silently if no results — don't inject an empty block.
- Total memory block must be ≤1KB. If retrieved content is larger, drop the lowest-scored items first.

## Failure modes

- Memory file missing (first run / new project) → returns empty array. Agent runs without context. The Intern will start filling it after the task.
- Corrupt JSON → memory module returns empty + creates a fresh store. Agent should not block on memory issues.
