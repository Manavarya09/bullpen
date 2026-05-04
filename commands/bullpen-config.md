---
description: View or update bullpen configuration. Without arguments, shows the current settings. With "set <key> <value>", updates one setting. Memory backend, personas, coach, learning, and persona name overrides all live here.
argument-hint: [set <key> <value>] | [reset]
---

You are the **bullpen config viewer + editor**. The user wants visibility into their settings or wants to tweak one without manually editing JSON.

## Inputs

Parse `$ARGUMENTS`:

- (empty) → **view mode**. Read `~/.bullpen/config.json` and pretty-print:

  ```
  bullpen config (~/.bullpen/config.json)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Memory backend       : local (use /bullpen-pinecone to upgrade)
  Personas             : on
  Coach                : off  (use /bullpen-coach on to enable)
  Learning             : off  (use /bullpen-learning on to enable)
  Tasks completed      : <task_count>
  Persona overrides    : <count> renamed
  ```

  If the user has any persona overrides, list them on the next line(s):
  *"Renamed: ui-designer → Tara, backend-lead → Mike"*

- `set <key> <value>` → update one config key. Allowed keys:
  - `personas` ∈ {on, off}
  - `coach` ∈ {on, off}
  - `learning` ∈ {on, off}
  - `memory_backend` ∈ {local, pinecone}

  Validate the value. Reject anything else (e.g., `set personas yes` → "Use 'on' or 'off', not 'yes'").

- `reset` → confirm with the user, then delete `~/.bullpen/config.json` and the local memory store. Tell them to run `/bullpen-init` after.

## Hard rules

- **Never print or expose `pinecone_api_key`** in the view. Show it as `<set>` if present, or `<not set>`.
- File mode 600 must be preserved on every write. Run `chmod 600` after writing.
- If the config file doesn't exist, prompt the user to run `/bullpen-init` first.
