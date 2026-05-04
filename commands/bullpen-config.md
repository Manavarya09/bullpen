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

  Personas             : on
  Coach                : off  (use /bullpen-coach on to enable)
  Learning             : off  (use /bullpen-learning on to enable)
  Tasks completed      : <task_count>
  Persona overrides    : <count> renamed
  Memory file          : <project_root>/.bullpen/memory.json
  ```

  Resolve `<project_root>` by running:
  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/memory.js where
  ```

  If the user has any persona overrides, list them on the next line(s):
  *"Renamed: ui-designer → Tara, backend-lead → Mike"*

- `set <key> <value>` → update one config key. Allowed keys:
  - `personas` ∈ {on, off}
  - `coach` ∈ {on, off}
  - `learning` ∈ {on, off}

  Validate the value. Reject anything else (e.g., `set personas yes` → "Use 'on' or 'off', not 'yes'").

- `reset` → confirm with the user, then delete `~/.bullpen/config.json`. Tell them to run `/bullpen-init` after. Do NOT touch the project's `.bullpen/memory.json` — that's per-project user data.

## Hard rules

- File mode 600 must be preserved on every write. Run `chmod 600` after writing.
- If the config file doesn't exist, prompt the user to run `/bullpen-init` first.
