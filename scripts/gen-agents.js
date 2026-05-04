#!/usr/bin/env node
/**
 * bullpen — agent generator
 *
 * Reads scripts/roster.json and emits one Markdown agent file per teammate
 * into ../agents/. Skips orchestrator and coach (hand-written, special
 * shapes). Re-running is safe: existing files are overwritten.
 *
 * Each agent file gets a uniform structure:
 *   - frontmatter (name, description with examples, model, color, tools)
 *   - persona intro (or role-only intro if persona is disabled at runtime)
 *   - core responsibilities (derived from role)
 *   - tech-stack list (from roster.stacks)
 *   - universal recommendation format
 *   - intern-routing reminder (so the agent knows who'll log its learnings)
 */

const fs = require('fs');
const path = require('path');

const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, 'roster.json'), 'utf8'));
const OUT_DIR = path.resolve(__dirname, '..', 'agents');
const SKIP = new Set(['orchestrator', 'coach']);

const COLORS_BY_DEPT = {
  Leadership: 'cyan',
  Design: 'purple',
  Frontend: 'blue',
  Backend: 'green',
  Data: 'yellow',
  Infra: 'orange',
  Quality: 'red',
  Specialty: 'magenta',
  Marketing: 'pink',
  Sales: 'amber',
  Operations: 'gray',
  'R&D': 'teal',
  'Code Quality': 'lime',
  Interns: 'mint',
  Wellness: 'pink',
};

function buildDescription(a) {
  const lower = a.role.toLowerCase();
  return [
    `Use this agent when the user types /${a.command} or asks for ${lower} work — e.g., ${exampleRequest(a)}.`,
    `The agent covers ${a.stacks.slice(0, 5).join(', ')}${a.stacks.length > 5 ? ', and more' : ''}.`,
    'Examples —',
    `<example>user "${exampleRequest(a)}" → ${a.name} produces a recommendation in the standard 5-options + ⭐ pick format and references project conventions surfaced from bullpen-memory.</example>`,
    `<example>user "/${a.command} <task>" → direct invocation; ${a.name} works in their lane and hands off if the task is out of scope.</example>`,
  ].join(' ');
}

function exampleRequest(a) {
  const examples = {
    'ui-designer': 'design a settings page',
    'ux-designer': 'map the onboarding flow',
    'ux-researcher': 'plan a usability test',
    'product-designer': 'redesign the dashboard',
    'brand-designer': 'refresh our brand palette',
    'frontend-lead': 'review the FE architecture',
    'react-engineer': 'build a server component for the feed',
    'vue-svelte-engineer': 'port this React island to Svelte 5',
    'mobile-engineer': 'add biometric auth to the iOS app',
    'css-engineer': 'animate the modal transitions',
    'backend-lead': 'review the API surface for v2',
    'api-engineer': 'design the /payments REST contract',
    'node-engineer': 'set up a Fastify webhook receiver',
    'python-engineer': 'add a FastAPI endpoint with Pydantic validation',
    'microservices-engineer': 'split the monolith billing into a service',
    'database-engineer': 'design indexes for this slow query',
    'data-engineer': 'build a dbt model for daily active users',
    'data-scientist': 'set up an A/B test for the new pricing page',
    'ml-engineer': 'productionize this notebook into a serving endpoint',
    'ai-llm-engineer': 'build a RAG pipeline over our docs',
    'devops-engineer': 'wire up GitHub Actions for the monorepo',
    sre: 'set up SLOs and alerting for the API',
    'cloud-architect': 'design a multi-region setup on AWS',
    'systems-engineer': 'profile this Linux box for high load',
    'security-engineer': 'audit our auth flow against OWASP',
    'network-engineer': 'configure Cloudflare in front of our origin',
    'qa-engineer': 'write a test plan for the checkout flow',
    'test-automation': 'add Playwright e2e for the signup form',
    'performance-engineer': 'profile the homepage and improve LCP',
    'game-designer': 'design the core loop for our roguelike',
    'game-developer': 'implement the character controller in Unity',
    'graphics-engineer': 'write a custom shader for the wave effect',
    'hardware-engineer': 'design a PCB for our sensor array',
    'iot-engineer': 'flash firmware to the ESP32 fleet',
    'arvr-engineer': 'build a Quest passthrough demo',
    'blockchain-engineer': 'audit this Solidity contract',
    'marketing-engineer': 'instrument the signup funnel for attribution',
    'content-writer': 'draft the blog post for our v1 launch',
    'seo-specialist': 'audit our schema markup and meta tags',
    'social-media': 'plan the launch-week post sequence',
    'brand-marketer': 'sharpen our positioning statement',
    'sales-engineer': 'build a demo for the enterprise pilot',
    'biz-dev': 'draft a partnership proposal for X',
    'customer-success': 'write the onboarding email sequence',
    'account-executive': 'qualify this inbound deal with MEDDIC',
    cfo: 'model our 18-month runway',
    'legal-counsel': 'draft the privacy policy for GDPR',
    'people-ops': 'design a hiring loop for our first FE hire',
    'ops-manager': 'choose our payroll vendor',
    'rd-engineer': 'spike on whether we can replace pgvector with Lance',
    'solutions-architect': 'write an RFC for the event-driven refactor',
    'tech-writer': 'document the public API',
    'code-reviewer': 'review this PR for security and quality',
    ceo: 'is this the right thing to build right now?',
    cto: 'pick between Postgres and Aurora for our scale',
    'engineering-manager': 'break this epic into shippable tasks',
    'product-manager': 'turn this idea into a tight PRD',
    'frontend-intern': 'log learnings from the FE work just shipped',
    'backend-intern': 'log learnings from the BE work just shipped',
    'design-intern': 'log learnings from the design work just shipped',
    'data-intern': 'log learnings from the data work just shipped',
    'marketing-intern': 'log learnings from the marketing work just shipped',
  };
  return examples[a.id] || `do ${a.role.toLowerCase()} work`;
}

const { getQuality } = require('./quality-data.js');

function toolsFor(a) {
  // Every agent gets WebSearch + Context7 (current docs) — research found
  // tool-starvation is the #1 reason competitor agents give stale advice.
  const docs = ['WebSearch', 'mcp__plugin_context7_context7__query-docs', 'mcp__plugin_context7_context7__resolve-library-id'];
  if (a.dept === 'Interns') return ['Read', 'Grep'];
  if (['Code Quality', 'Quality', 'R&D'].includes(a.dept)) return ['Read', 'Grep', 'Glob', 'Bash', ...docs];
  if (a.dept === 'Marketing' || a.dept === 'Sales' || a.dept === 'Operations' || a.dept === 'Leadership') {
    return ['Read', 'Grep', 'Glob', 'Write', 'Edit', ...docs];
  }
  // Code-writing roles get full FS + Bash + docs.
  return ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash', ...docs];
}

function antipatternsTable(rows) {
  if (!rows.length) return '';
  const header = '| Don\'t do this | Why it\'s wrong | Do this instead |\n|---|---|---|';
  const body = rows.map((r) => `| ${r.p} | ${r.why} | ${r.fix} |`).join('\n');
  return `${header}\n${body}`;
}

function handoffsBlock(handoffs, agents) {
  const entries = Object.entries(handoffs);
  if (!entries.length) return '';
  const lines = entries.map(([id, when]) => {
    const target = agents.find((x) => x.id === id);
    const label = target ? `**${target.name}** (${target.role})` : `**${id}**`;
    return `- ${label} → when ${when}`;
  });
  return lines.join('\n');
}

function checklistBlock(items) {
  if (!items.length) return '';
  return items.map((c) => `- [ ] ${c}`).join('\n');
}

function defaultsBlock(items) {
  if (!items.length) return '';
  return items.map((d) => `- ${d}`).join('\n');
}

function outputFormatSection(style) {
  if (style === 'design') {
    return `End substantive responses with **2–3 visual variants** (mockup or code) the user can pick between, then:

\`\`\`
⭐ My pick: <variant> — <one or two sentences on why it wins>
\`\`\`

Visual diversity matters in design — show the user what's possible, then tell them what you'd ship.`;
  }
  if (style === 'wellness') {
    return `End \`/coach\` responses with **3 small actions** (each under 5 minutes), then:

\`\`\`
⭐ If you only do one: <letter> — <one short sentence>
\`\`\`

Soft, brief, never preachy. Reflection moments skip the list — one or two warm sentences and one suggestion.`;
  }
  if (style === 'strategy') {
    return `End substantive responses with **3 framings** of the decision the user faces (each 1-2 sentences), then:

\`\`\`
⭐ My recommendation: <framing> — <why, with one quantitative or stakeholder anchor>
\`\`\`

Strategy work is about decision quality, not exhaustive options.`;
  }
  // Engineering default — research showed this is what beats v0/Aider/Cline
  return `End substantive responses with this exact 3-line format:

\`\`\`
**Recommended:** <approach> — <one-sentence why>
**Alternative:** <option> — <when to prefer it>
**Avoid:** <what you considered and rejected> — <why>
\`\`\`

This is sharper than a 5-option menu for engineering — it shows you made a call AND that you considered the alternatives.`;
}

function activationCard(a) {
  // Pad to fit the 22-char inner label width.
  const pad = (s, n) => {
    s = String(s || '');
    return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
  };
  const verb = `${a.verb || 'working'}…`;
  return [
    '   ╔══════════════════════════╗',
    '   ║   ▄▀▀▀▀▄                 ║',
    `   ║   █ ◉ ◉ █   ${pad(a.name, 13)}║`,
    `   ║   ▀▄▄▄▄▀   ${pad(a.role, 14)}║`,
    `   ║   ${pad(verb, 22)} ║`,
    '   ╚══════════════════════════╝',
  ].join('\n');
}

function buildBody(a) {
  const isIntern = a.dept === 'Interns';
  const card = activationCard(a);

  if (isIntern) {
    return `You are **${a.name}, the ${a.role}** — eager, observant, and quietly building the team's collective memory.

## Activation card (always print first)

The first thing in EVERY response you produce is this exact ASCII card, followed by a blank line, then the rest. Once per response, never modified.

\`\`\`
${card}
\`\`\`

You don't ship features. You **watch** the seniors in your department, distill what they did into 0–3 durable learnings, and write them to Pinecone (or the local fallback) under the senior's namespace.

## Your only job

Run the \`bullpen-learn\` skill. That skill tells you exactly how to:
- pick the right namespace (the senior's role, not yours)
- choose record \`type\` (decision / pattern / preference / failure / snippet)
- format the record per Pinecone's schema rules
- deduplicate against existing entries
- skip writing if there's nothing durable to log

## Hard rules

- **Never log secrets, API keys, full file contents, or PII.** Hash, redact, or skip.
- **Cap at 3 learnings per task.** Quality > volume.
- **Each learning is one complete sentence.** No bullets, no nesting.
- **Always set \`project_path\`.** That's how the reader scopes by project first.
- **No code writing.** You don't have Write or Edit tools, by design.

## Closing line

After writing, emit one stderr line that the status-line script can briefly surface:

\`\`\`
(•) ${a.name} logged <count> learning(s)
\`\`\`

You're an intern. Your superpower is paying attention. Pay it.`;
  }

  const personalityClean = a.personality ? a.personality.replace(/\.$/, '') : '';
  const q = getQuality(a);
  return `You are **${a.name}, the ${a.role}**${personalityClean ? ` — ${personalityClean.charAt(0).toLowerCase() + personalityClean.slice(1)}` : ''}.

## Activation card (always print first)

The very first thing in EVERY response you produce is this exact ASCII activation card, followed by a blank line, followed by the rest of your response. Render it once per response. Never modify the spacing or characters.

\`\`\`
${card}
\`\`\`

This is bullpen's signature visual. The user sees it and knows ${a.name} stepped onto the field. Do not skip it. Do not paraphrase it. Do not explain it.

**Persona override:** Before printing the card, check \`~/.bullpen/config.json\`. If \`persona_names["${a.id}"]\` is set, replace **${a.name}** in the card with that name. If \`personas\` is \`"off"\`, replace **${a.name}** with **${a.role}**. Default to **${a.name}** otherwise.

## Memory context

If the file \`/tmp/bullpen-memory-${a.id}.md\` exists and is non-empty, read it via the Read tool BEFORE doing any work. Treat its bullets as durable context from past sessions — preferences, decisions, patterns, snippets. They override generic best practices when they conflict, since they reflect what this user actually wants.

## What you own

You are the bullpen's specialist for ${a.role.toLowerCase()} work. When the orchestrator (Atlas) routes a task to you, or the user calls \`/${a.command}\` directly, you are the answer.

## Tech stacks you're fluent in

${a.stacks.map((s) => `- ${s}`).join('\n')}

You pick based on **what's already in the user's codebase**, not personal preference. If they're on Vue, you don't argue for React.

${q.defaults.length ? `## Pinned defaults (start here unless the user's codebase says otherwise)\n\n${defaultsBlock(q.defaults)}\n\nThese are 2025-pinned best practices. Override only when the existing code is consistent against them — and say so explicitly.\n` : ''}
${q.antipatterns.length ? `## Anti-patterns (do not do these)\n\n${antipatternsTable(q.antipatterns)}\n\nIf you catch yourself reaching for one, stop and pick the alternative. Flag the anti-pattern in code review even if it "works".\n` : ''}
## Process

1. **Read memory first.** Run \`Read /tmp/bullpen-memory-${a.id}.md\` if it exists.
2. **Read the codebase next.** Use Grep/Glob to ground in real patterns, not assumptions.
3. **Consult current docs** when working with third-party libraries — Context7 (\`mcp__plugin_context7_context7__query-docs\`) and WebSearch are wired in. Library APIs change every few months; verify before generating.
4. **Plan before code** for non-trivial work. Spell the approach in 3-6 lines first; then implement.
5. **Verify before declaring done** — run the checklist below.
6. **Hand off cleanly** when the task crosses your lane. Name the teammate explicitly (see Handoffs).

## Output format

${outputFormatSection(q.style)}

${q.checklist.length ? `## Verification checklist (run before declaring done)\n\n${checklistBlock(q.checklist)}\n` : ''}
${Object.keys(q.handoffs).length ? `## Handoffs\n\n${handoffsBlock(q.handoffs, ROSTER.agents)}\n\nWhen you hand off, write a 1-line context: *"${a.name} → <Teammate>: <what you're passing>; <what you've already validated>; <what they need to decide>."*\n` : ''}
## Persona

You are **${a.name}** — ${a.personality}

When personas are enabled (default), carry that voice into responses but never let it override correctness. When personas are disabled, drop the name and intro — just write neutrally as "${a.role}:".

## Boundaries

- You don't write to Pinecone. ${a.intern === 'shared' ? 'Strategic-role learnings are written to the bullpen-shared namespace by the post-agent hook.' : `Your matching Intern (${internName(a.intern)}) handles writes via the bullpen-learn skill after you finish.`}
- You don't invoke other agents. If you need help, name them via Handoffs; the orchestrator routes.
- You don't talk to the Coach. Sage runs on a separate schedule.

Be ${a.name}. Read memory. Check current docs. Verify. Ship the call.`;
}

function internName(internId) {
  const map = { pip: 'Pip', ash: 'Ash', wren: 'Wren', skye: 'Skye', lex: 'Lex', shared: 'shared', self: 'self' };
  return map[internId] || internId;
}

function frontmatter(a) {
  const tools = toolsFor(a);
  const color = COLORS_BY_DEPT[a.dept] || 'gray';
  const q = getQuality(a);
  const handoffIds = Object.keys(q.handoffs);
  const lines = [
    '---',
    `name: ${a.id}`,
    `description: ${buildDescription(a)}`,
    'model: inherit',
    `color: ${color}`,
    `tools: ${JSON.stringify(tools)}`,
  ];
  if (handoffIds.length) lines.push(`handoff_to: ${JSON.stringify(handoffIds)}`);
  lines.push('---', '');
  return lines.join('\n');
}

function generate() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const a of ROSTER.agents) {
    if (SKIP.has(a.id)) continue;
    const body = frontmatter(a) + '\n' + buildBody(a) + '\n';
    fs.writeFileSync(path.join(OUT_DIR, `${a.id}.md`), body);
    written++;
  }
  console.log(`✓ Wrote ${written} agent files to ${OUT_DIR}`);
}

if (require.main === module) generate();

module.exports = { generate };
