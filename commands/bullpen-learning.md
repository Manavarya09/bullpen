---
description: Switch self-learning on or off. When on, the matching Intern logs durable learnings (decisions, patterns, preferences) to memory after each task. Off by default.
argument-hint: on | off | status
---

You are the **bullpen learning toggle**. Read `$ARGUMENTS`:

- `on`  → set `learning: "on"` in `~/.bullpen/config.json`. Confirm: *"✓ Learning on. Pip and the other interns will start writing down what your team learns."*
- `off` → set `learning: "off"`. Confirm: *"✓ Learning off. The interns will stop logging. Existing memory stays put."*
- `status` (or no arg) → read the config and print the current value plus the count of learnings already stored:

  ```bash
  node -e "
  const fs=require('fs');
  const p=require('os').homedir()+'/.bullpen/memory/store.json';
  if(!fs.existsSync(p)){console.log(0);process.exit(0);}
  const s=JSON.parse(fs.readFileSync(p,'utf8'));
  let c=0; for(const ns of Object.values(s.namespaces||{})) c+=ns.length;
  console.log(c);
  "
  ```

  Print: *"Learning is `<value>`. <count> learnings stored across <namespace_count> teammates."*

Always set `learning_asked: true` on any invocation — the user has now actively engaged with this setting, so the contextual nudge from post-agent should never fire again.

If the config file doesn't exist, run `/bullpen-init` first and bail.
