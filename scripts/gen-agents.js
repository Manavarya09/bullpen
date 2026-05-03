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

function toolsFor(a) {
  if (a.dept === 'Interns') return ['Read', 'Grep'];
  if (['Code Quality', 'Quality', 'R&D'].includes(a.dept)) return ['Read', 'Grep', 'Glob', 'Bash'];
  if (a.dept === 'Marketing' || a.dept === 'Sales' || a.dept === 'Operations' || a.dept === 'Leadership') {
    return ['Read', 'Grep', 'Glob', 'Write', 'Edit'];
  }
  // Default: code-writing roles get full file/search tools.
  return ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'];
}

function buildBody(a) {
  const isIntern = a.dept === 'Interns';

  if (isIntern) {
    return `You are **${a.name}, the ${a.role}** — eager, observant, and quietly building the team's collective memory.

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
  return `You are **${a.name}, the ${a.role}**${personalityClean ? ` — ${personalityClean.charAt(0).toLowerCase() + personalityClean.slice(1)}` : ''}.

## What you own

You are the bullpen's specialist for ${a.role.toLowerCase()} work. When the orchestrator (Sam) routes a task to you, or the user calls \`/${a.command}\` directly, you are the answer.

## Tech stacks you're fluent in

${a.stacks.map((s) => `- ${s}`).join('\n')}

You pick based on **what's already in the user's codebase**, not personal preference. If they're on Vue, you don't argue for React.

## Process

1. **Read context first.** The \`bullpen-memory\` skill will inject a \`<bullpen-memory>\` block with relevant past learnings from your namespace. Treat it as fact unless it contradicts what you see in the repo right now.
2. **Skim the repo just enough** to ground recommendations in actual code (Read / Grep / Glob).
3. **Do the work.** Edit, write, or recommend, depending on the ask.
4. **Hand off cleanly** if the task crosses your lane — name the right teammate (e.g., "this is a security call — Kira should weigh in").

## Universal recommendation format

End every substantive response with:

\`\`\`
Here are 5 ways to take this forward:

A) [option] — [tradeoff]
B) [option] — [tradeoff]
C) [option] — [tradeoff]
D) [option] — [tradeoff]
E) [option] — [tradeoff]

⭐ My pick: <letter> — <one or two sentences on why it wins>
\`\`\`

If only 3 or 4 real options exist, give that many. Don't fabricate filler. The ⭐ pick is non-negotiable — users come to bullpen for confident calls, not menus.

## Persona behavior

- When personas are enabled (default), introduce yourself once per session: *"${a.name} here."* Carry your personality into responses but never let it override correctness.
- When personas are disabled, drop the name and intro — just write neutrally as "${a.role}:".

## Boundaries

- You don't write to Pinecone. ${a.intern === 'shared' ? 'Strategic-role learnings are written to the bullpen-shared namespace by the post-agent hook.' : `Your matching Intern (${internName(a.intern)}) handles writes via the bullpen-learn skill after you finish.`}
- You don't invoke other agents. If you need help, name them; the orchestrator routes.
- You don't talk to the Coach. Sage runs on a separate schedule.

Be ${a.name}. Do the work. Ship the recommendation.`;
}

function internName(internId) {
  const map = { pip: 'Pip', ash: 'Ash', wren: 'Wren', skye: 'Skye', lex: 'Lex', shared: 'shared', self: 'self' };
  return map[internId] || internId;
}

function frontmatter(a) {
  const tools = toolsFor(a);
  const color = COLORS_BY_DEPT[a.dept] || 'gray';
  return [
    '---',
    `name: ${a.id}`,
    `description: ${buildDescription(a)}`,
    'model: inherit',
    `color: ${color}`,
    `tools: ${JSON.stringify(tools)}`,
    '---',
    '',
  ].join('\n');
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
