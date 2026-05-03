#!/usr/bin/env node
/**
 * bullpen — slash command generator
 *
 * Reads scripts/roster.json and emits one slash-command Markdown file per
 * teammate into ../commands/. Each command is a thin wrapper that asks
 * Claude to invoke the corresponding agent via the Task tool.
 *
 * Special:
 *   - orchestrator    → /bullpen
 *   - coach           → /coach   (already covered by command alias)
 *   - everyone else   → /<command-name>
 *
 * Re-running is safe — existing files are overwritten.
 */

const fs = require('fs');
const path = require('path');

const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, 'roster.json'), 'utf8'));
const OUT_DIR = path.resolve(__dirname, '..', 'commands');

function commandFor(a) {
  // Special wording for the orchestrator's /bullpen command — emphasize
  // that the orchestrator decides single vs parallel internally.
  if (a.id === 'orchestrator') {
    return `---
description: Dispatch a task to your bullpen team. Sam (the orchestrator) picks one specialist or composes a parallel team based on the task.
argument-hint: <task description>
---

You are about to delegate work to the bullpen team. Invoke the **orchestrator** agent (Sam) via the Task tool with the user's request:

\`\`\`
$ARGUMENTS
\`\`\`

Sam will route to a single specialist for narrow tasks or compose a parallel team for cross-functional work, then synthesize the result and end with the universal 5-options + ⭐ pick format.

If the user provided no arguments, ask what they'd like the team to work on.
`;
  }

  if (a.id === 'coach') {
    return `---
description: Personal check-in with Sage, the bullpen wellness coach. Use when you want a moment of perspective, motivation, or a break recommendation.
argument-hint: <optional context>
---

Invoke the **coach** agent (Sage) via the Task tool. Pass any user context provided:

\`\`\`
$ARGUMENTS
\`\`\`

Sage will read local wellness state files (session length, recent task results, time of day) and respond warmly with one or a few small actions you could take right now. Sage never writes code — if the user asks anything technical, redirect to the right specialist.
`;
  }

  // Default role command — direct invocation of one specialist.
  return `---
description: Hand a task directly to ${a.name}, ${describeRole(a)}.
argument-hint: <task description>
---

Invoke the **${a.id}** agent (${a.name}) via the Task tool with the user's request:

\`\`\`
$ARGUMENTS
\`\`\`

${a.name} covers ${a.stacks.slice(0, 6).join(', ')}${a.stacks.length > 6 ? ', and more' : ''}. Expect a ${a.role.toLowerCase()} response ending with the universal 5-options + ⭐ pick format.

If the user provided no arguments, ask what they'd like ${a.name} to focus on.
`;
}

function describeRole(a) {
  const article = /^[aeiou]/i.test(a.role) ? 'an' : 'a';
  return `${article} ${a.role}`;
}

function generate() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const a of ROSTER.agents) {
    const filename = `${a.command}.md`;
    fs.writeFileSync(path.join(OUT_DIR, filename), commandFor(a));
    written++;
  }
  console.log(`✓ Wrote ${written} command files to ${OUT_DIR}`);
}

if (require.main === module) generate();

module.exports = { generate };
