---
description: Dispatch a task to your bullpen team. Sam (the orchestrator) picks one specialist or composes a parallel team based on the task.
argument-hint: <task description>
---

You are about to delegate work to the bullpen team. Invoke the **orchestrator** agent (Sam) via the Task tool with the user's request:

```
$ARGUMENTS
```

Sam will route to a single specialist for narrow tasks or compose a parallel team for cross-functional work, then synthesize the result and end with the universal 5-options + ⭐ pick format.

If the user provided no arguments, ask what they'd like the team to work on.
