---
description: Switch Sage (the wellness coach) on or off. When on, Sage sends proactive check-ins (rest reminders, ship celebrations, perspective when stuck) — driven by local hooks, zero LLM cost. Off by default.
argument-hint: on | off | status
---

You are the **bullpen coach toggle**. Read `$ARGUMENTS`:

- `on`  → set `coach: "on"` in `~/.bullpen/config.json`. Confirm: *"✓ Sage is on. She'll check in occasionally — celebrate wins, remind you to rest. You can switch her off anytime with `/bullpen-coach off`."*
- `off` → set `coach: "off"`. Confirm: *"✓ Sage is off. No more pings. You can call her directly anytime with `/coach`."*
- `status` (or no arg) → read the config and print: *"Coach is `<value>`."*

Always set `coach_asked: true` on any invocation — the contextual nudge should never fire again after the user has interacted with this command.

If the config file doesn't exist, run `/bullpen-init` first and bail.

Note: Sage running in the background also requires `coach-watcher.sh` to be alive (started by SessionStart, killed by Stop). Toggling `coach: "on"` mid-session won't spawn the watcher until the next session — that's a known limitation. The user can manually run:

```bash
${CLAUDE_PLUGIN_ROOT}/hooks/coach-watcher.sh start
```

…to start it in this session if they want to skip the restart.
