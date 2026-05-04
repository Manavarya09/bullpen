#!/usr/bin/env bash
# bullpen — smoke test suite
# Runs end-to-end checks on roster integrity, hooks, memory loop,
# nudge sequencing, and natural-language routing.
#
# Usage: bash scripts/test.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
RESULTS=""

assert() {
  local name="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    PASS=$((PASS + 1))
    RESULTS+="  ✓ $name\n"
  else
    FAIL=$((FAIL + 1))
    RESULTS+="  ✗ $name\n"
  fi
}

echo "━━━ bullpen smoke tests ━━━"
echo ""

# Clean slate
rm -rf ~/.bullpen "$TMPDIR/bullpen-"* 2>/dev/null || true

# Test 1: preflight
out=$(node scripts/preflight.js 2>&1)
[[ "$out" == *"✓ Node"* ]] && assert "preflight passes" ok || assert "preflight passes" fail

# Test 2: roster integrity (uniqueness)
out=$(node -e "const r=require('./scripts/roster.json').agents; const i=new Set(r.map(a=>a.id)); const c=new Set(r.map(a=>a.command)); const n=new Set(r.map(a=>a.name)); console.log(r.length===64 && i.size===64 && c.size===64 && n.size===64 ? 'ok' : 'fail')")
assert "roster has 64 unique agents/commands/names" "$out"

# Test 3: pre-agent renders ASCII card
out=$(echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"Rune"* ]] && [[ "$out" == *"UI Designer"* ]] && assert "pre-agent renders activation card" ok || assert "pre-agent renders activation card" fail

# Test 4: state file written
[ -s "$TMPDIR/bullpen-status" ] && assert "pre-agent writes state file" ok || assert "pre-agent writes state file" fail

# Test 5: statusline reads state
out=$(node hooks/statusline.js 2>&1)
[[ "$out" == *"Rune"* ]] && assert "statusline renders from state" ok || assert "statusline renders from state" fail

# Test 6: persona override applies
node -e "const fs=require('fs'),os=require('os'),p=os.homedir()+'/.bullpen';fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/config.json',JSON.stringify({personas:'on',persona_names:{'ui-designer':'Tara'},learning:'off'}))"
out=$(echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js 2>&1)
[[ "$out" == *"Tara"* ]] && assert "persona rename overrides default name" ok || assert "persona rename overrides default name" fail

# Test 7: post-agent fires nudge at task 1
rm -rf ~/.bullpen
node -e "const fs=require('fs'),os=require('os'),p=os.homedir()+'/.bullpen';fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/config.json',JSON.stringify({personas:'on',coach:'off',learning:'off',task_count:0,learning_asked:false,coach_asked:false,naming_asked:false}))"
echo '{"tool_input":{"subagent_type":"bullpen:ui-designer"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
out=$(echo '{"tool_response":{"is_error":false}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/post-agent.js 2>&1)
[[ "$out" == *"Sprout"* ]] && assert "post-agent fires Sprout nudge at task 1" ok || assert "post-agent fires Sprout nudge at task 1" fail

# Test 8: memory write when learning is on
rm -rf ~/.bullpen
node -e "const fs=require('fs'),os=require('os'),p=os.homedir()+'/.bullpen';fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/config.json',JSON.stringify({memory_backend:'local',personas:'on',learning:'on',task_count:0}))"
node scripts/pinecone-fallback.js init >/dev/null 2>&1
echo '{"tool_input":{"subagent_type":"bullpen:ui-designer","prompt":"design a button"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
echo '{"tool_response":{"content":[{"text":"Built a primary button using Tailwind classes bg-blue-500 hover:bg-blue-600 with rounded-lg and px-4 py-2 spacing. Added focus ring for accessibility. Used the existing Button component pattern from src/components/ui/button.tsx."}]}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/post-agent.js >/dev/null 2>&1
out=$(node scripts/pinecone-fallback.js search ui-designer "tailwind button" 5 2>/dev/null)
[[ "$out" == *"Tailwind"* ]] && assert "memory write stores task snippet" ok || assert "memory write stores task snippet" fail

# Test 9: memory read injects into context file
echo '{"tool_input":{"subagent_type":"bullpen:ui-designer","prompt":"design another button"}}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/pre-agent.js >/dev/null 2>&1
ctx="$TMPDIR/bullpen-memory-ui-designer.md"
[ -f "$ctx" ] && [ -s "$ctx" ] && assert "memory read writes context file" ok || assert "memory read writes context file" fail

# Test 10: natural-language routing emits hint
out=$(echo '{"prompt":"design a button using tailwind classes"}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
if [[ "$out" == *"ui-designer"* ]] || [[ "$out" == *"UI Designer"* ]]; then
  assert "user-prompt hook routes design tasks to ui-designer" ok
else
  assert "user-prompt hook routes design tasks to ui-designer" fail
fi

# Test 11: natural-language routing stays silent on slash commands
out=$(echo '{"prompt":"/bullpen do something"}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
[ -z "$out" ] && assert "user-prompt stays silent on slash commands" ok || assert "user-prompt stays silent on slash commands" fail

# Test 12: natural-language routing stays silent on no clear match
out=$(echo '{"prompt":"hello"}' | CLAUDE_PLUGIN_ROOT="$ROOT" node hooks/user-prompt.js 2>&1)
[ -z "$out" ] && assert "user-prompt stays silent on weak matches" ok || assert "user-prompt stays silent on weak matches" fail

# Cleanup
rm -rf ~/.bullpen "$TMPDIR/bullpen-"* 2>/dev/null || true

echo ""
echo -e "$RESULTS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed  /  $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
