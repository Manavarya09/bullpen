---
name: bullpen-learn
description: Use this skill after a bullpen agent completes a task to extract 0-3 durable learnings (decisions, patterns, preferences, failures, or code snippets) and write them to Pinecone (or the local fallback) under that agent's namespace. The matching Intern agent runs this. Keep each learning self-contained and project-scoped.
---

# bullpen-learn

This skill is invoked by the matching Intern after a senior bullpen agent finishes a task. It extracts durable learnings and persists them so future sessions can recall them via `bullpen-memory`.

## When to use

After every senior agent task completes successfully OR fails informatively. Triggered by the `post-agent.sh` hook enqueueing the (`agent_id`, `timestamp`, `status`) tuple.

Skip if:
- The senior agent's output was trivially short (under ~200 chars) — nothing durable to learn.
- The task was a pure read (`/bullpen-knowledge`, etc.) — no new learning.
- An identical learning already exists in the namespace (deduplicate by exact text).

## Intern routing

Pick the right Intern based on the senior agent's department:

| Senior Department | Logging Intern | Namespace |
|---|---|---|
| Frontend, Mobile, CSS, UI Designer, Brand Designer | Pip (frontend-intern) | senior's role |
| Backend, API, Node, Python, Microservices, Infra (all), QA, Test Auto, Performance, Game Dev, Graphics, Hardware, IoT, AR/VR, Blockchain | Ash (backend-intern) | senior's role |
| Product Designer, UX Designer, UX Researcher, Game Designer | Wren (design-intern) | senior's role |
| DBA, Data Engineer, Data Scientist, ML, AI/LLM | Skye (data-intern) | senior's role |
| Marketing (all), Sales (all) | Lex (marketing-intern) | senior's role |
| Leadership, PM, EM, CEO, CTO, Operations, Legal, Finance, HR, R&D, Solutions Architect, Tech Writer, Code Reviewer, Coach | (no intern persona) | `bullpen-shared` |

## What to extract

Read the senior's task summary + output. Identify 0-3 **durable** facts that would help the same agent next time. Each gets a `type`:

- **decision** — a choice the user made between alternatives. *"User chose Postgres over MySQL because of JSONB."*
- **pattern** — a code or design convention now established in the project. *"All forms use `useFormHook` wrapper."*
- **preference** — a personal preference of the user. *"User prefers Tailwind over CSS modules."*
- **failure** — a thing that didn't work and should be avoided. *"Tried Drizzle migrations — user reverted, prefers Prisma."*
- **snippet** — a short, reusable code excerpt (≤500 chars) tied to context.

**Skip non-durable noise**: one-off task descriptions, conversational chatter, questions the user asked, generic best-practice advice not specific to this project.

## How to write

### Path A — Pinecone

```
mcp__plugin_pinecone_pinecone__upsert-records
  index: "bullpen-memory"
  namespace: <senior_role | "bullpen-shared">
  records: [
    {
      id: "<uuid>",
      text: "<the learning, natural language, complete sentence>",
      type: "decision" | "pattern" | "preference" | "failure" | "snippet",
      agent_role: "<senior_role>",
      project_path: "<absolute path>",
      created_at: "<ISO 8601>",
      session_id: "<session id>",
      ref_files: "<comma-separated list of files referenced, may be empty>"
    }
  ]
```

Per Pinecone's record-schema rules: single fieldMap (`text` is the embedded field), no nested objects, no top-level `metadata` field.

### Path B — Local fallback

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/pinecone-fallback.js upsert <namespace> '<json-record>'
```

## After writing

If at least one learning was written, emit a short stderr line that the status-line script can pick up briefly:

```
(•) Pip logged 2 learnings
```

(Replace `Pip` with the intern's persona name and the count with the actual number.)

## Rules

- Each learning is one complete sentence. No bullet lists, no nested structure.
- Project-scope every learning by setting `project_path`. The reader filters on this first.
- Idempotency: if the new learning's text is already present (case-insensitive exact match) in the namespace, skip the upsert.
- Never log secrets, API keys, full file contents, or PII. The Intern's system prompt enforces this.
- Cap output at 3 learnings per task even if more are tempting — quality over quantity keeps retrieval signal high.
