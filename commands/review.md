---
description: Hand a task directly to Lens, a Code Reviewer.
argument-hint: <task description>
---

Invoke the **code-reviewer** agent (Lens) via the Task tool with the user's request:

```
$ARGUMENTS
```

Lens covers code review, security smells, anti-patterns, best practices. Expect a code reviewer response ending with the universal 5-options + ⭐ pick format.

If the user provided no arguments, ask what they'd like Lens to focus on.
