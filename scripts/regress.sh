#!/usr/bin/env bash
# bullpen — full regression suite
# Goes beyond smoke. Validates every agent, every command, every hook,
# every skill, every script, every config integrity assertion.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0
RESULTS=""

ok()   { PASS=$((PASS+1)); RESULTS+="  ✓ $1\n"; }
fail() { FAIL=$((FAIL+1)); RESULTS+="  ✗ $1${2:+ — $2}\n"; }
warn() { WARN=$((WARN+1)); RESULTS+="  ⚠ $1${2:+ — $2}\n"; }

echo "━━━ bullpen full regression ━━━"
echo ""

# Clean slate
rm -rf ~/.bullpen "$TMPDIR/bullpen-"* 2>/dev/null || true

# ─── STRUCTURE ─────────────────────────────────────────────
[ -f .claude-plugin/plugin.json ] && ok "plugin.json present" || fail "plugin.json missing"
[ -f .claude-plugin/marketplace.json ] && ok "marketplace.json present" || fail "marketplace.json missing"

node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json'))" 2>/dev/null && ok "plugin.json valid JSON" || fail "plugin.json invalid"
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))" 2>/dev/null && ok "marketplace.json valid JSON" || fail "marketplace.json invalid"

# ─── ROSTER INTEGRITY ──────────────────────────────────────
node -e "const r=require('./scripts/roster.json').agents; if(r.length!==64) process.exit(1)" && ok "roster has exactly 64 agents" || fail "roster wrong size"

DUPES=$(node -e "const r=require('./scripts/roster.json').agents; const ids={},cmds={},names={}; let d=[]; r.forEach(a=>{if(ids[a.id])d.push('id:'+a.id); ids[a.id]=1; if(cmds[a.command])d.push('cmd:'+a.command); cmds[a.command]=1; if(names[a.name])d.push('name:'+a.name); names[a.name]=1;}); console.log(d.length?d.join(','):'')")
[ -z "$DUPES" ] && ok "roster all unique" || fail "roster duplicates" "$DUPES"

# Every roster entry has required fields
node -e "const r=require('./scripts/roster.json').agents; const req=['id','name','role','dept','glyph','personality','stacks','intern','command','verb']; let bad=[]; r.forEach(a=>req.forEach(f=>{ if(!(f in a)) bad.push(a.id+':'+f); })); if(bad.length) console.log(bad.join(',')); else console.log('OK')" | grep -q "^OK$" && ok "roster fields complete" || fail "roster missing fields"

# ─── AGENTS ────────────────────────────────────────────────
AGENT_COUNT=$(ls agents/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$AGENT_COUNT" = "64" ] && ok "64 agent files exist" || fail "agent file count = $AGENT_COUNT"

# Every agent has frontmatter with required fields
BAD_AGENTS=""
for f in agents/*.md; do
  head -10 "$f" | grep -q "^name:" || BAD_AGENTS+="$(basename $f) "
done
[ -z "$BAD_AGENTS" ] && ok "every agent has frontmatter" || fail "missing frontmatter" "$BAD_AGENTS"

# Every non-intern agent has Activation card section
MISSING_CARD=""
for f in agents/*.md; do
  base=$(basename "$f" .md)
  case "$base" in
    *-intern) continue;;
  esac
  grep -q "Activation card" "$f" || MISSING_CARD+="$base "
done
[ -z "$MISSING_CARD" ] && ok "every agent has Activation card section" || fail "missing activation card" "$MISSING_CARD"

# Every coding agent has anti-patterns table
MISSING_ANTIP=""
for role in react-engineer ui-designer backend-lead security-engineer database-engineer devops-engineer api-engineer ai-llm-engineer; do
  grep -q "Anti-patterns" "agents/${role}.md" || MISSING_ANTIP+="$role "
done
[ -z "$MISSING_ANTIP" ] && ok "key roles have anti-patterns" || fail "missing anti-patterns" "$MISSING_ANTIP"

# Verification checklist on engineering agents
MISSING_CHECK=""
for role in react-engineer backend-lead security-engineer database-engineer devops-engineer; do
  grep -q "Verification checklist" "agents/${role}.md" || MISSING_CHECK+="$role "
done
[ -z "$MISSING_CHECK" ] && ok "engineering roles have checklist" || fail "missing checklist" "$MISSING_CHECK"

# ─── COMMANDS ──────────────────────────────────────────────
CMD_COUNT=$(ls commands/*.md 2>/dev/null | wc -l | tr -d ' ')
[ "$CMD_COUNT" -ge 64 ] && ok "≥64 command files exist ($CMD_COUNT total)" || fail "command count = $CMD_COUNT"

# Every roster command has a corresponding command file
node -e "
const fs=require('fs');
const r=require('./scripts/roster.json').agents;
let missing=[];
r.forEach(a=>{ if(!fs.existsSync('commands/'+a.command+'.md')) missing.push(a.command); });
if(missing.length) console.log(missing.join(',')); else console.log('OK');
" | grep -q "^OK$" && ok "every roster role has a command" || fail "missing command files"

# Utility commands
for c in bullpen-init bullpen-config bullpen-name bullpen-knowledge bullpen-learning bullpen-coach bullpen-pinecone; do
  [ -f "commands/${c}.md" ] && true || fail "missing command" "$c"
done
ok "utility commands present"

# ─── HOOKS ─────────────────────────────────────────────────
[ -f hooks/hooks.json ] && ok "hooks.json present" || fail "hooks.json missing"
node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json'))" 2>/dev/null && ok "hooks.json valid JSON" || fail "hooks.json invalid"

for h in pre-agent.js post-agent.js statusline.js user-prompt.js; do
  [ -f "hooks/$h" ] && ok "hooks/$h exists" || fail "missing hook" "$h"
  node --check "hooks/$h" 2>/dev/null && ok "hooks/$h valid syntax" || fail "syntax error" "$h"
done

[ -f hooks/coach-watcher.sh ] && [ -x hooks/coach-watcher.sh ] && ok "coach-watcher.sh executable" || fail "coach-watcher missing or not executable"

# ─── SKILLS ────────────────────────────────────────────────
for s in bullpen-memory bullpen-learn react-rsc idempotent-apis; do
  [ -f "skills/$s/SKILL.md" ] && ok "skills/$s/SKILL.md exists" || fail "missing skill" "$s"
done

# ─── SCRIPTS ───────────────────────────────────────────────
for s in roster.json glyphs.json coach-messages.json gen-agents.js gen-commands.js memory.js pinecone-fallback.js pinecone-init.js preflight.js quality-data.js test.sh; do
  [ -f "scripts/$s" ] && ok "scripts/$s exists" || fail "missing script" "$s"
done

for s in gen-agents.js gen-commands.js memory.js pinecone-fallback.js pinecone-init.js preflight.js quality-data.js; do
  node --check "scripts/$s" 2>/dev/null && ok "scripts/$s valid syntax" || fail "syntax error" "$s"
done

# ─── PREFLIGHT ─────────────────────────────────────────────
node scripts/preflight.js >/dev/null 2>&1 && ok "preflight passes" || fail "preflight failed"

# ─── ASCII CARDS render for ALL non-intern agents ──────────
CARD_FAILS=""
for id in $(node -e "const r=require('./scripts/roster.json').agents; r.forEach(a=>{ if(!a.id.endsWith('-intern')) console.log(a.id) })"); do
  out=$(echo "{\"tool_input\":{\"subagent_type\":\"bullpen:$id\"}}" | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
  if [[ "$out" != *"╔"* ]] || [[ "$out" != *"╚"* ]]; then
    CARD_FAILS+="$id "
  fi
done
[ -z "$CARD_FAILS" ] && ok "ASCII card renders for all 59 non-intern agents" || fail "card render failures" "$CARD_FAILS"

# ─── NAMESPACE STRIPPING ───────────────────────────────────
out=$(echo '{"tool_input":{"subagent_type":"bullpen:backend-lead"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"Forge"* ]] && ok "namespaced subagent_type resolves to Forge" || fail "namespace strip broken"

out=$(echo '{"tool_input":{"subagent_type":"backend-lead"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"Forge"* ]] && ok "bare subagent_type resolves to Forge" || fail "bare id resolution broken"

# ─── PERSONA OVERRIDE ──────────────────────────────────────
mkdir -p ~/.bullpen
echo '{"personas":"on","persona_names":{"backend-lead":"Mike"},"learning":"off"}' > ~/.bullpen/config.json
out=$(echo '{"tool_input":{"subagent_type":"bullpen:backend-lead"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"Mike"* ]] && ok "persona override 'Mike' applied" || fail "persona override broken"

# Personas off → role name
echo '{"personas":"off","learning":"off"}' > ~/.bullpen/config.json
out=$(echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"UI Designer"* ]] && ok "personas off shows role name" || fail "personas-off broken"

# ─── STATUS LINE ANIMATION ─────────────────────────────────
echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
F1=$(node hooks/statusline.js 2>&1)
F2=$(node hooks/statusline.js 2>&1)
F3=$(node hooks/statusline.js 2>&1)
[ "$F1" != "$F2" ] && [ "$F2" != "$F3" ] && ok "status line dot animation cycles" || fail "status line static"

# ─── MEMORY LOOP ───────────────────────────────────────────
rm -rf ~/.bullpen
mkdir -p ~/.bullpen
echo '{"memory_backend":"local","personas":"on","learning":"on","task_count":0}' > ~/.bullpen/config.json
node scripts/pinecone-fallback.js init >/dev/null 2>&1

# Write
echo '{"tool_input":{"subagent_type":"bullpen:database-engineer","prompt":"design index for slow query"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
echo '{"tool_response":{"content":[{"text":"Created a partial index on user_events(user_id, created_at) WHERE deleted_at IS NULL. Verified query plan now uses Index Scan instead of Seq Scan. Reduced latency from 800ms to 12ms."}]}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/post-agent.js >/dev/null 2>&1

out=$(node scripts/pinecone-fallback.js search database-engineer "partial index" 5 2>/dev/null)
[[ "$out" == *"partial index"* ]] && ok "memory write stores DB snippet" || fail "memory write broken"

# Read injects to context file
echo '{"tool_input":{"subagent_type":"bullpen:database-engineer","prompt":"another slow query problem"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
ctx="$TMPDIR/bullpen-memory-database-engineer.md"
[ -s "$ctx" ] && grep -q "partial index" "$ctx" && ok "memory read injects past learning" || fail "memory read broken"

# ─── NUDGE SEQUENCING ──────────────────────────────────────
rm -rf ~/.bullpen
mkdir -p ~/.bullpen
echo '{"personas":"on","coach":"off","learning":"off","task_count":0,"learning_asked":false,"coach_asked":false,"naming_asked":false}' > ~/.bullpen/config.json

NUDGE_FOUND=""
for i in 1 2 3 4 5; do
  echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
  out=$(echo '{"tool_response":{"is_error":false}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/post-agent.js 2>&1)
  case $i in
    1) [[ "$out" == *"Sprout"* ]] && NUDGE_FOUND+="1" ;;
    3) [[ "$out" == *"Sage"* ]] && NUDGE_FOUND+="3" ;;
    5) [[ "$out" == *"rename"* ]] && NUDGE_FOUND+="5" ;;
  esac
done
[ "$NUDGE_FOUND" = "135" ] && ok "nudges fire at tasks 1, 3, 5" || fail "nudge sequence broken" "got=$NUDGE_FOUND"

# ─── NL ROUTING ────────────────────────────────────────────
declare -a routes=(
  "design a button using tailwind classes:ui-designer"
  "write a fastapi endpoint with pydantic:python-engineer"
  "review this pr for security:code-reviewer"
  "audit our auth flow against owasp:security-engineer"
  "set up github actions for the monorepo:devops-engineer"
)
ROUTE_FAILS=""
for entry in "${routes[@]}"; do
  prompt="${entry%:*}"
  expected="${entry##*:}"
  out=$(echo "{\"prompt\":\"$prompt\"}" | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
  [[ "$out" == *"$expected"* ]] || ROUTE_FAILS+="$expected:$prompt | "
done
[ -z "$ROUTE_FAILS" ] && ok "NL routing hits 5/5 expected roles" || fail "NL routing failures" "$ROUTE_FAILS"

# Stays silent on slash + weak match
out=$(echo '{"prompt":"/bullpen test"}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
[ -z "$out" ] && ok "NL routing silent on slash" || fail "NL routing leaked on slash"

out=$(echo '{"prompt":"hi"}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
[ -z "$out" ] && ok "NL routing silent on weak match" || fail "NL routing leaked on weak match"

# ─── COACH WATCHER ─────────────────────────────────────────
CLAUDE_PLUGIN_ROOT="$ROOT" bash hooks/coach-watcher.sh start
sleep 0.5
status=$(CLAUDE_PLUGIN_ROOT="$ROOT" bash hooks/coach-watcher.sh status 2>&1)
[[ "$status" == *"running"* ]] && ok "coach-watcher starts" || warn "coach-watcher start (may be intentional if disabled)"
CLAUDE_PLUGIN_ROOT="$ROOT" bash hooks/coach-watcher.sh stop
status=$(CLAUDE_PLUGIN_ROOT="$ROOT" bash hooks/coach-watcher.sh status 2>&1)
[[ "$status" == *"stopped"* ]] && ok "coach-watcher stops cleanly" || fail "coach-watcher stop broken"

# ─── ROUNDTRIP MEMORY (Pinecone fallback) ─────────────────
rm -rf ~/.bullpen
node scripts/pinecone-fallback.js init >/dev/null 2>&1
node scripts/pinecone-fallback.js upsert react-engineer '{"id":"t1","text":"User chose Tailwind over CSS modules","type":"preference","agent_role":"react-engineer","project_path":"/x","created_at":"2026-05","session_id":"s","ref_files":""}' >/dev/null 2>&1
out=$(node scripts/pinecone-fallback.js search react-engineer "tailwind preference" 3 2>/dev/null)
[[ "$out" == *"Tailwind"* ]] && ok "fallback store roundtrip works" || fail "fallback store broken"

# Cleanup
rm -rf ~/.bullpen "$TMPDIR/bullpen-"* 2>/dev/null || true

echo ""
echo -e "$RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed  /  $FAIL failed  /  $WARN warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
