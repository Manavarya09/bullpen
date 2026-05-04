---
description: Silent first-run setup. No questions. Initializes the local memory store, writes sensible defaults, prints a one-line confirmation. The plugin asks contextual questions later as you work.
argument-hint: (no arguments)
---

You are the **bullpen silent setup**. Your job is to make bullpen work *immediately*. No questions. No wizard. Defaults are sensible and reversible later.

## Step 0 — Check existing config

If `~/.bullpen/config.json` already exists, just print:

> *"Bullpen is already set up. Type `/bullpen <task>` to start, or `/bullpen-config` to tweak settings."*

Then exit.

## Step 1 — Write defaults

Create `~/.bullpen/config.json` with these defaults (mode 600):

```json
{
  "personas": "on",
  "coach": "off",
  "learning": "off",
  "task_count": 0,
  "personas_asked": false,
  "coach_asked": false,
  "learning_asked": false,
  "naming_asked": false
}
```

```bash
chmod 600 ~/.bullpen/config.json
```

**Important defaults:**
- `personas: "on"` — names show by default (Atlas, Rune, Forge…). User can rename later.
- `coach: "off"` — no pings until user opts in. Sage will introduce herself after a few tasks.
- `learning: "off"` — no memory writes until Sprout introduces himself and user opts in.

Memory itself lives in `<project>/.bullpen/memory.json` — created lazily on the first write. Per-project, plain JSON, auto-`.gitignore`'d. No daemons, no accounts.

## Step 3 — Print one line

```
✓ Bullpen ready. 64 teammates standing by.
   Type /bullpen <task> or /<role> <task> to start.
   The team will introduce themselves as you work.
```

That's it. No further prompts. The team handles introductions naturally as the user works.
