# Bullpen — Design Spec

**Status:** Draft v1
**Date:** 2026-05-04
**Author:** manavaryasingh
**Tagline:** *Your deep bench of 64 AI specialists. Warming up to step in on demand.*

---

## 1. Vision

Bullpen is an open-source Claude Code plugin that gives you a complete AI engineering company — 64 named, persona-driven specialists — orchestrated by a team lead, learning from every session, and rendered with cinematic terminal flair (ASCII art activation cards, Pokemon-style status glyphs, proactive wellness check-ins).

It is **not** an "agent orchestration platform" — it is **your team**. People relate to colleagues, not swarms.

### Why it beats existing alternatives

| Dimension | Ruflo and similar | Bullpen |
|-----------|-------------------|---------|
| Pitch | "Multi-agent orchestration platform" | "Your AI engineering team" |
| Mental model | Anonymous swarms | Named teammates with personalities |
| Onboarding | 32 plugins, 314 MCP tools | 1 plugin, 1 init |
| Memory | Opaque shared pool | Browsable per-role namespaces |
| Wellness | None | The Coach proactively cares for you |
| Visual | Generic CLI output | ASCII activation cards + status glyphs |

---

## 2. Architecture

### High-level shape

```
bullpen/
├── .claude-plugin/plugin.json
├── commands/
│   ├── bullpen.md                # /bullpen <task>  → orchestrator
│   ├── bullpen-init.md           # one-time setup
│   ├── bullpen-name.md           # persona naming wizard
│   ├── bullpen-knowledge.md      # browse what each teammate has learned
│   ├── coach.md                  # /coach for direct wellness check-in
│   ├── frontend.md               # one slash command per teammate (×63)
│   ├── backend.md
│   └── ...
├── agents/
│   ├── orchestrator.md           # team lead — routes & parallelizes
│   ├── coach.md                  # The Coach — wellness mentor
│   ├── frontend-lead.md          # one .md per teammate (×62)
│   └── ...
├── skills/
│   ├── bullpen-memory/           # how agents read Pinecone before tasks
│   └── bullpen-learn/            # how agents write to Pinecone after tasks
├── hooks/
│   ├── hooks.json                # PreToolUse / PostToolUse / SessionStart
│   ├── pre-agent.sh              # writes ASCII card + status glyph
│   ├── post-agent.sh             # clears status, triggers intern logging
│   ├── coach-watcher.sh          # background timer for wellness pings
│   └── statusline.sh             # reads state, animates dots
├── scripts/
│   ├── pinecone-init.js          # creates index + namespaces
│   ├── pinecone-fallback.js      # local SQLite fallback
│   └── glyphs.json               # role → ASCII glyph map
└── README.md
```

### Three entry points

1. **`/bullpen <task>`** — Orchestrator picks teammate(s), runs in parallel when needed.
2. **`/<role> <task>`** — Direct call to one specialist (e.g., `/backend add /users`).
3. **Natural language** — Hooks watch user prompts; route to the right teammate when keywords match (e.g., "design a login page" → ux-designer triggers).

### Shared state

- **Config:** `~/.bullpen/config.json` (persona names, "don't ask again" flag, Pinecone key)
- **Active state:** `/tmp/bullpen-status` (current agent, started_at — read by status line)
- **Wellness state:** `/tmp/bullpen-coach` (session start, error streak, last-break)

---

## 3. The Roster (64 teammates)

### 3.1 Leadership (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 1 | Orchestrator (Team Lead) | Sam — calm router, delegates ruthlessly | `[*]` |
| 2 | CEO | Ava — vision, prioritization, "is this the right thing?" | `<C>` |
| 3 | CTO | Theo — architecture, tech tradeoffs, deep tech | `[T]` |
| 4 | Engineering Manager | Priya — task breakdown, sprint planning | `[M]` |
| 5 | Product Manager | Liam — specs, requirements, user stories | `[P]` |

### 3.2 Design (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 6 | Product Designer | Noor — end-to-end design thinking | `(P)` |
| 7 | UX Designer | Jordan — flows, wireframes, interaction | `<U>` |
| 8 | UI Designer | Maya — pixel-perfect, Figma die-hard | `[◇]` |
| 9 | UX Researcher | Rin — research, usability heuristics | `(R)` |
| 10 | Brand Designer | Mateo — identity, type, color systems | `[B]` |

### 3.3 Frontend (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 11 | Frontend Lead | Chen — FE arch, code review | `</>` |
| 12 | React/Next Engineer | Tara — RSC, app router, performance | `(R)` |
| 13 | Vue/Svelte Engineer | Felix — alt frameworks, reactivity | `(V)` |
| 14 | Mobile Engineer | Aiko — RN, iOS, Android | `[M]` |
| 15 | CSS/Animation Engineer | Lila — Tailwind, motion, polish | `(*)` |

### 3.4 Backend (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 16 | Backend Lead | Raj — clean APIs, allergic to N+1 | `[#]` |
| 17 | API Engineer | Mira — REST, GraphQL, contracts | `[~]` |
| 18 | Node.js Engineer | Ben — Node, NestJS, Express | `(N)` |
| 19 | Python Engineer | Anika — Django, FastAPI, Flask | `(y)` |
| 20 | Microservices Engineer | Diego — service boundaries, events | `[%]` |

### 3.5 Data (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 21 | Database Engineer | Kenji — SQL, indexes, migrations | `[=]` |
| 22 | Data Engineer | Olu — pipelines, ETL, warehouses | `[!]` |
| 23 | Data Scientist | Hana — stats, modeling, insights | `(o)` |
| 24 | ML Engineer | Wei — training, inference, MLOps | `(✦)` |
| 25 | AI/LLM Engineer | Zara — prompting, RAG, agents | `[L]` |

### 3.6 Infrastructure (6)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 26 | DevOps Engineer | Marco — CI/CD, Docker, K8s | `{^}` |
| 27 | SRE | Ivy — monitoring, alerts, incidents | `[+]` |
| 28 | Cloud Architect | Bash — AWS/GCP/Azure design | `(c)` |
| 29 | Systems Engineer | Yuki — Linux, networking, perf | `[L]` |
| 30 | Security Engineer | Kira — paranoid by design, OWASP | `<§>` |
| 31 | Network Engineer | Tomas — DNS, CDN, routing | `(N)` |

### 3.7 Quality (3)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 32 | QA Engineer | Sasha — test plans, edge cases | `[?]` |
| 33 | Test Automation Engineer | Reza — Cypress, Playwright, Jest | `[~]` |
| 34 | Performance Engineer | Naomi — profiling, load tests | `[!]` |

### 3.8 Specialty (7)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 35 | Game Designer | Kai — mechanics, level design | `(g)` |
| 36 | Game Developer | Ren — Unity, Unreal, Godot | `[G]` |
| 37 | Graphics/3D Engineer | Astra — Three.js, WebGL, shaders | `(o)` |
| 38 | Hardware Engineer | Bolt — PCBs, schematics | `[H]` |
| 39 | IoT/Embedded Engineer | Echo — firmware, edge, MQTT | `(e)` |
| 40 | AR/VR Engineer | Nova — spatial computing, Unity XR | `[V]` |
| 41 | Blockchain Engineer | Sato — Solidity, Web3, contracts | `[$]` |

### 3.9 Marketing (5)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 42 | Marketing Engineer | Eli — analytics, attribution, growth loops | `[A]` |
| 43 | Content Writer | Saanvi — blogs, copy, voice | `(w)` |
| 44 | SEO Specialist | Pax — on-page, schema, technical SEO | `[Q]` |
| 45 | Social Media Manager | Cleo — channels, scheduling, trends | `(s)` |
| 46 | Brand Marketer | Theo-B — positioning, narrative | `[+]` |

### 3.10 Sales (4)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 47 | Sales Engineer | Hugo — demos, technical objections | `[$]` |
| 48 | Business Development | Iris — partnerships, deals | `(b)` |
| 49 | Customer Success | Mei — onboarding, retention | `[♡]` |
| 50 | Account Executive | Roman — pipeline, close motion | `[!]` |

### 3.11 Operations (4)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 51 | CFO / Finance | Della — budgets, runway, unit economics | `[¤]` |
| 52 | Legal / Compliance | Inez — terms, privacy, IP, GDPR | `[§]` |
| 53 | HR / People Ops | Joon — hiring, policy, culture | `(h)` |
| 54 | Operations Manager | Cyrus — vendor mgmt, ops, logistics | `[o]` |

### 3.12 R&D + Misc (3)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 55 | R&D Engineer | Atlas — experimental prototypes, spikes | `(*)` |
| 56 | Solutions Architect | Vera — system design, RFCs, diagrams | `[S]` |
| 57 | Technical Writer | Rumi — docs, API refs, READMEs | `[D]` |

### 3.13 Code Quality (1)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 58 | Code Reviewer | Otis — PR reviews, code quality, security smells | `[√]` |

### 3.14 Interns — The Self-Learning Class (5)

These five quietly observe their senior counterparts and write learnings to Pinecone. They are the embodiment of the self-learning system.

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 59 | Frontend Intern | Pip — eager, watching FE tasks | `(•)` |
| 60 | Backend Intern | Ash — eager, watching BE tasks | `(•)` |
| 61 | Design Intern | Wren — eager, watching design tasks | `(•)` |
| 62 | Data Intern | Skye — eager, watching data tasks | `(•)` |
| 63 | Marketing Intern | Lex — eager, watching marketing tasks | `(•)` |

### 3.15 The Coach (1)

| # | Role | Default Persona | Glyph |
|---|------|-----------------|-------|
| 64 | The Coach | Sage — wellness mentor, proactive | `(♡)` |

---

## 4. Agent Behavior Standards

### 4.1 Universal recommendation format

Every agent's system prompt enforces this output shape:

```
Here are 5 ways to approach this:

A) [option] — [tradeoff]
B) [option] — [tradeoff]
C) [option] — [tradeoff]
D) [option] — [tradeoff]
E) [option] — [tradeoff]

⭐ My pick: B — [why it wins]
```

If the task is genuinely binary or has fewer real options, the agent gives the actual count (e.g., 3 options instead of forcing 5).

### 4.2 Tech stack coverage

Each agent's system prompt explicitly lists every relevant tech stack in their domain. Example for Frontend Lead: React, Vue, Svelte, Solid, Astro, Qwik, Remix, Next.js, Nuxt, SvelteKit, Lit, Stencil, Preact, Alpine.js. The agent picks the right tool based on the user's existing codebase, not personal preference.

### 4.3 Persona behavior

When personas are enabled:
- Agent introduces themselves on first activation in a session ("Hey, Maya here.")
- Personality flavor in responses (e.g., Kira always flags security implications, Raj groans at N+1 queries)
- Personality is light — never overrides correctness

When personas are disabled:
- Agent uses role name only ("UI Designer:")
- No first-person flair

---

## 5. The Learning Layer

### 5.1 Pinecone index design

- **Index name:** `bullpen-memory`
- **Embedding model:** `multilingual-e5-large` (Pinecone-hosted, 1024-dim) by default
- **Namespaces:** one per role (64 total) + one shared `bullpen-shared`

### 5.2 Record schema (consistent across all namespaces)

Per Pinecone best practice — single fieldMap, no nested objects, no `metadata` field:

```json
{
  "id": "<uuid>",
  "text": "<the learning, as natural language>",
  "type": "decision | pattern | preference | failure | snippet",
  "agent_role": "ui-designer",
  "project_path": "/abs/path/to/project",
  "created_at": "2026-05-04T12:00:00Z",
  "session_id": "<id>",
  "ref_files": "src/auth.ts,src/auth.test.ts"
}
```

### 5.3 Read flow (PreToolUse)

1. Hook fires when an agent is about to run.
2. Embeds the user's task using the same embedding model.
3. Queries the agent's namespace for top 5 relevant memories (filtered to current `project_path` first; falls back to global if fewer than 3 hits).
4. Injects retrieved memories as a `<bullpen-memory>` block in the agent's system prompt.

### 5.4 Write flow (PostToolUse)

1. Hook fires after agent completes a task.
2. An **Intern agent** is invoked silently with the task summary + the senior's output. Intern routing:
   - **Pip (FE Intern)** → Frontend, Mobile, CSS/Animation, UI Designer, Brand Designer
   - **Ash (BE Intern)** → Backend, API, Node, Python, Microservices, Infra (DevOps/SRE/Cloud/Systems/Security/Network), QA, Test Automation, Performance, Game Dev, Graphics, Hardware, IoT, AR/VR, Blockchain
   - **Wren (Design Intern)** → Product Designer, UX Designer, UX Researcher, Game Designer
   - **Skye (Data Intern)** → DBA, Data Engineer, Data Scientist, ML, AI/LLM
   - **Lex (Marketing Intern)** → Marketing, Content, SEO, Social, Brand Marketer, Sales (all)
   - **Strategic roles** (Leadership, PM, EM, CEO, CTO, Ops, Legal, Finance, HR, R&D, Solutions Architect, Tech Writer, Code Reviewer) → write directly to `bullpen-shared` namespace, no intern persona wrapper.
3. Intern (or shared writer) extracts 0–3 learnings and writes them to Pinecone in the senior's namespace.
4. Status line briefly shows: `(•) Pip logged 2 learnings`.

### 5.5 Local fallback

If no Pinecone API key is configured, the plugin falls back to **SQLite + sqlite-vss** (local sentence-transformers embeddings). Same schema, slower retrieval, fully offline. Users can migrate to Pinecone any time via `/bullpen-init`.

### 5.6 Knowledge browser

`/bullpen-knowledge <role>` queries Pinecone for that role's namespace and pretty-prints the most recent learnings in groups by `type`. Memory you can read = trust.

---

## 6. The Visual System (Zero Tokens)

### 6.1 ASCII activation card (PreToolUse hook)

Printed once when an agent activates. Rendered locally to stderr — does not enter LLM context.

```
   ╔══════════════════════════╗
   ║   ▄▀▀▀▀▄                 ║
   ║   █ ◉ ◉ █   Maya         ║
   ║   ▀▄▄▄▄▀   UI Designer   ║
   ║   sketching wireframes…  ║
   ╚══════════════════════════╝
```

The face block is fixed; the right-side label and bottom action line vary per role/task.

### 6.2 Status line glyphs

Compact 3-char ASCII glyphs in the status line, mapped per role (see roster). Format:

```
[◇] Maya (UI Designer) is sketching .  .  .
```

Animation: dots cycle `.` → `..` → `...` based on Claude Code's status line refresh cadence (the script reads a counter from the state file and outputs the next frame).

### 6.3 Glyph map

All glyphs live in `scripts/glyphs.json` so users can customize.

---

## 7. The Coach (Wellness Layer)

### 7.1 Triggers (driven by local hooks, not LLM)

| Trigger | Source | Message pool |
|---------|--------|--------------|
| 2+ hours active session | `coach-watcher.sh` (timer) | "Take 5? Stretch, water, breath." (×50 variants) |
| Task shipped (commit succeeded) | PostToolUse hook | "I'm proud of you. 🌱" (×50 variants) |
| 3+ errors in row | PostToolUse hook | "Tough loop. Step back?" (×50 variants) |
| After 11pm local | `coach-watcher.sh` | "It's late. Save and call it?" (×50 variants) |
| First commit of day | PostToolUse hook | "Morning. Let's ship something small." (×50 variants) |

Pre-written messages live in `scripts/coach-messages.json`. **No LLM calls** for these — pure local randomization. Soft terminal bell on delivery.

### 7.2 LLM-powered check-ins

Only when the user runs `/coach` directly. Then the Coach agent is invoked normally with personalized context (recent tasks, time, struggle signals) and gives a real reflection.

---

## 8. Onboarding Flow

### 8.1 First-run wizard (`/bullpen-init`)

```
👋 Welcome to bullpen.

Step 1/3 — Pinecone (for memory)
   Don't have a key? https://app.pinecone.io (free tier works)
   Paste API key, or press [Enter] to use local SQLite fallback:

Step 2/3 — Personas
   Want to give your 64 teammates names + personalities?
   [Y] Yes, walk me through it
   [N] No, role names only (ask again next session)
   [D] Don't ask again — defaults are fine

Step 3/3 — Coach
   Allow proactive wellness check-ins?
   [Y/N]

✓ Bullpen ready. Type `/bullpen <task>` or just describe what you need.
```

### 8.2 Persona naming wizard (`/bullpen-name`)

Lists default personas in groups of 5; user can accept-all-and-continue or rename inline. Saves to `~/.bullpen/config.json`.

---

## 9. Security & Privacy

- API keys stored in `~/.bullpen/config.json` with file mode `600`.
- Pinecone records include `project_path` so data is project-scoped on retrieval.
- No telemetry. No data leaves the user's machine except Pinecone writes.
- Local fallback path requires no external network.
- Project-level `.bullpen-ignore` file lets users exclude paths/files from being embedded.

---

## 10. v1 Scope (Everything Ships)

| Component | Files |
|-----------|-------|
| Plugin manifest | `.claude-plugin/plugin.json` |
| Slash commands | `commands/*.md` (×67: `/bullpen` (orchestrator), `/coach`, 62 other role commands, `/bullpen-init`, `/bullpen-name`, `/bullpen-knowledge`) |
| Agents | `agents/*.md` (×64) |
| Memory skills | `skills/bullpen-memory/`, `skills/bullpen-learn/` |
| Hooks | `hooks/hooks.json` + 4 shell scripts |
| Pinecone scripts | `scripts/pinecone-init.js`, `scripts/pinecone-fallback.js` |
| Glyph + message data | `scripts/glyphs.json`, `scripts/coach-messages.json` |
| Setup wizard | `commands/bullpen-init.md` |
| Persona wizard | `commands/bullpen-name.md` |
| Knowledge browser | `commands/bullpen-knowledge.md` |
| Landing copy | `README.md`, `LICENSE` (MIT) |

**Distribution:** Open-source, MIT, published to GitHub. Installable via `/plugin marketplace add <user>/bullpen`.

---

## 11. Out of Scope for v1

- Federation / cross-machine agents (ruflo's territory; revisit in v2 if demand)
- Web dashboard / UI (terminal-first by design)
- Multi-user / team-shared Pinecone namespaces
- Custom user-added agents (v1 ships fixed roster of 64; v1.1 may add `/bullpen-hire`)
- Voice / audio output for The Coach (text + bell only)

---

## 12. Open Questions (resolved during planning, not blocking spec)

- Exact PreToolUse hook contract — does `claude-code` pass agent name in env or argv?
- Ordering of intern writes when multiple agents complete in parallel (likely sequential queue keyed on `session_id`).
- How to gracefully degrade when Pinecone is unreachable mid-session (cache writes locally, replay on reconnect).
