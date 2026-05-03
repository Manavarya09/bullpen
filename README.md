<div align="center">

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
   ║   █ ◉ ◉ █   Maya         ║
   ║   ▀▄▄▄▄▀   UI Designer   ║
   ║   sketching wireframes…  ║
   ╚══════════════════════════╝
```

A compact status glyph (e.g., `[◇] Maya is sketching ...`) stays in your status line while they work. **Zero token cost** — all rendered locally.

### They learn from every session

Pinecone-backed semantic memory, namespaced per role. Five Intern agents quietly observe their senior counterparts and write learnings after every task. The seniors get smarter. You can browse what each teammate knows:

```bash
/bullpen-knowledge maya
```

No Pinecone? bullpen falls back to a local SQLite vector store. Same schema, fully offline.

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
