#!/usr/bin/env node
/**
 * bullpen — UserPromptSubmit hook
 *
 * Reads the user's typed prompt from stdin, scans for keywords that
 * map to bullpen specialists, and (when there's a strong match)
 * prepends a one-line routing hint that nudges Claude toward
 * delegating to the right teammate via the Task tool.
 *
 * Stays silent if no clear match — never gets in the way.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const ROSTER_PATH = path.join(ROOT, 'scripts', 'roster.json');

// Role-keyword map. Picked so each phrase strongly implies one specialist.
// Avoid generic words ('code', 'fix', 'add') that match too much.
const KEYWORDS = {
  'ui-designer': ['ui design', 'design a button', 'design a page', 'wireframe', 'mockup', 'figma', 'tailwind classes', 'shadcn'],
  'ux-designer': ['ux flow', 'user flow', 'onboarding flow', 'interaction design', 'user journey'],
  'ux-researcher': ['usability test', 'user research', 'user interview'],
  'brand-designer': ['brand identity', 'logo design', 'brand palette', 'color system'],
  'product-designer': ['design system', 'redesign'],
  'frontend-lead': ['frontend architecture', 'fe arch', 'component architecture'],
  'react-engineer': ['react component', 'next.js', 'nextjs', 'app router', 'server component'],
  'vue-svelte-engineer': ['vue component', 'svelte component', 'sveltekit'],
  'mobile-engineer': ['react native', 'ios app', 'android app', 'expo'],
  'css-engineer': ['css animation', 'tailwind', 'framer motion', 'gsap'],
  'backend-lead': ['backend architecture', 'be architecture', 'api design'],
  'api-engineer': ['rest api', 'graphql', 'openapi', 'api contract'],
  'node-engineer': ['fastify', 'express', 'nestjs', 'node.js endpoint'],
  'python-engineer': ['fastapi', 'django', 'flask', 'pydantic'],
  'database-engineer': ['database schema', 'sql query', 'postgres', 'mysql', 'index', 'migration'],
  'data-engineer': ['etl', 'pipeline', 'dbt', 'airflow', 'data warehouse'],
  'data-scientist': ['a/b test', 'experiment design', 'statistical', 'analyze metrics'],
  'ml-engineer': ['ml model', 'train a model', 'serving endpoint', 'mlops'],
  'ai-llm-engineer': ['rag pipeline', 'prompt engineering', 'llm agent', 'embeddings'],
  'devops-engineer': ['ci/cd', 'github actions', 'docker', 'kubernetes', 'helm chart', 'gitlab ci'],
  sre: ['slo', 'monitoring', 'alerting', 'on-call', 'incident'],
  'cloud-architect': ['aws architecture', 'gcp setup', 'cloudformation', 'terraform'],
  'security-engineer': ['owasp', 'auth flow', 'jwt', 'oauth', 'security audit', 'vulnerability'],
  'qa-engineer': ['test plan', 'edge cases'],
  'test-automation': ['cypress', 'playwright', 'e2e test'],
  'performance-engineer': ['lighthouse', 'core web vitals', 'lcp', 'profile this', 'load test'],
  'game-developer': ['unity', 'unreal', 'godot', 'game engine'],
  'graphics-engineer': ['three.js', 'webgl', 'shader', 'glsl'],
  'blockchain-engineer': ['solidity', 'smart contract', 'web3'],
  'marketing-engineer': ['attribution', 'analytics setup', 'segment', 'posthog instrumentation', 'mixpanel'],
  'content-writer': ['blog post', 'landing copy', 'email sequence', 'newsletter copy'],
  'seo-specialist': ['seo audit', 'schema markup', 'meta tags', 'on-page seo'],
  'social-media': ['twitter post', 'linkedin post', 'social calendar'],
  'tech-writer': ['readme', 'api docs', 'documentation'],
  'code-reviewer': ['review this pr', 'code review', 'review this diff'],
  cfo: ['runway', 'burn rate', 'unit economics', 'financial model'],
  'legal-counsel': ['privacy policy', 'terms of service', 'gdpr', 'soc2', 'ccpa'],
  coach: ['feeling stuck', 'burned out', 'need a break', 'check in on me'],
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 200);
  });
}

function scoreMatch(prompt, phrases) {
  const lc = prompt.toLowerCase();
  let score = 0;
  for (const p of phrases) {
    if (lc.includes(p)) score += p.length; // longer phrases score higher
  }
  return score;
}

async function main() {
  const raw = await readStdin();
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const prompt = payload?.prompt || payload?.user_message || '';
  if (!prompt || prompt.length < 8) process.exit(0);

  // Don't route if the user already invoked a slash command — they know what they want.
  if (prompt.trim().startsWith('/')) process.exit(0);

  let bestId = null;
  let bestScore = 0;
  for (const [id, phrases] of Object.entries(KEYWORDS)) {
    const s = scoreMatch(prompt, phrases);
    if (s > bestScore) {
      bestScore = s;
      bestId = id;
    }
  }

  // Require a non-trivial match (>= 6 chars total of matched phrase length)
  if (!bestId || bestScore < 6) process.exit(0);

  // Look up the persona name for the hint
  let agentName = bestId;
  let agentRole = bestId;
  try {
    const roster = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
    const a = roster.agents.find((x) => x.id === bestId);
    if (a) {
      agentName = a.name;
      agentRole = a.role;
    }
  } catch {}

  // Emit additionalContext via JSON so Claude Code injects it into the LLM context.
  // This is the documented mechanism for UserPromptSubmit hooks.
  const out = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: `[bullpen] This task likely belongs to ${agentName} (${agentRole}). Consider invoking the bullpen agent "${bestId}" via the Task tool, or call /${bestId.replace(/-/g, '')} directly.`,
    },
  };
  process.stdout.write(JSON.stringify(out));
}

main().catch(() => process.exit(0));
