<div align="center">

<!-- Banner: drop assets/banner.png here. Prompt for generating it lives in docs/banner-prompt.md -->

# bullpen

**Your deep bench of 64 AI specialists. Warming up to step in on demand.**

A Claude Code plugin that gives you a complete AI engineering company — designers, engineers, marketers, sales, ops, even a wellness coach — orchestrated as a team, self-learning over time, rendered with cinematic terminal flair.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Why bullpen?

Other agent plugins give you anonymous "swarms." Bullpen gives you **a team**.

| | Other agent platforms | **bullpen** |
|---|---|---|
| Pitch | "Multi-agent orchestration" | "Your AI engineering team" |
| Mental model | Anonymous swarms | Named teammates with personalities |
| Onboarding | Dozens of plugins, hundreds of tools | One plugin, one init |
| Memory | Opaque shared pool | Browsable per-role namespaces |
| Wellness | None | The Coach proactively cares for you |
| Visual | Generic CLI output | ASCII activation cards + status glyphs |

---

## Install

```bash
/plugin marketplace add Manavarya09/bullpen
/plugin install bullpen@bullpen
/bullpen-init
```

### Optional: enable the status-line glyph

Add this to `~/.claude/settings.json` so the active teammate's glyph appears above your prompt:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/statusline.js"
  }
}
```

(The plugin works without it — you'll still see the ASCII activation cards. The status line is just the persistent ambient touch.)

---

## How it works

### Three ways to call your team

```bash
# 1. Let the orchestrator pick the right teammate(s)
/bullpen build me a login flow with magic links

# 2. Call a specialist directly
/backend add a /users endpoint with pagination
/ux design a settings page

# 3. Just describe what you need — natural-language hooks route automatically
```

### Cinematic activation

When a teammate spins up, you see them step onto the field:

```
   ╔══════════════════════════╗
   ║   ▄▀▀▀▀▄                 ║
   ║   █ ◉ ◉ █   Rune         ║
   ║   ▀▄▄▄▄▀   UI Designer   ║
   ║   sketching…             ║
   ╚══════════════════════════╝
```

A compact status glyph (e.g., `[◇] Rune is sketching ...`) stays in your status line while they work. **Zero token cost** — all rendered locally.

### They actually know their stuff

Every agent has:
- **Pinned 2025 framework defaults** (e.g., React 19.2 + Next.js 16 RSC by default, not "let me ask which version")
- **Anti-pattern tables** with explicit "don't do this / do this" rows
- **Verification checklists** they run before declaring done
- **Explicit handoff conditions** to other teammates when work crosses lanes
- **Context7 + WebSearch** wired in for current library docs

The differentiator isn't headcount — it's that each agent makes a confident call and shows you what they considered.

### They learn from every session

Per-role memory namespaces. After each task, the matching Intern logs durable learnings (decisions, patterns, preferences, snippets) so the next session benefits.

```bash
/bullpen-knowledge rune
```

**Backend:** local JSON store by default (zero deps), or Pinecone via `/bullpen-pinecone`. Hybrid retrieval (BM25 + dense) and cross-encoder reranking are on the roadmap — current retrieval is good enough to be useful, honest about not yet being SOTA.

### The Coach

Sage, your team's wellness mentor, is the only AI teammate who asks if you've eaten today. Driven by local hooks (no LLM calls):

> *You've been at this 2 hours. Stretch, water, breath.*
> *That auth flow was tricky. You nailed it. I'm proud of you. 🌱*

---

## The Roster

**64 teammates** across 15 departments — Leadership, Design, Frontend, Backend, Data, Infra, Quality, Specialty (Game/Hardware/AR-VR/Blockchain), Marketing, Sales, Operations (Finance/Legal/HR), R&D, Code Quality, Interns, and The Coach.

See the full roster and design in [docs/superpowers/specs/2026-05-04-bullpen-design.md](docs/superpowers/specs/2026-05-04-bullpen-design.md).

---

## License

MIT — see [LICENSE](LICENSE).
