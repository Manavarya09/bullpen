#!/usr/bin/env bash
# bullpen — pre-agent hook
# Fires before any Task tool call. Reads subagent_type from stdin JSON,
# looks up the matching teammate in roster.json, prints an ASCII activation
# card to stderr (visible in terminal, NOT injected into LLM context), and
# writes a small state file the status line script reads.
#
# Zero LLM cost — entirely local rendering.

set -euo pipefail

ROSTER="${CLAUDE_PLUGIN_ROOT}/scripts/roster.json"
STATE_FILE="${TMPDIR:-/tmp}/bullpen-status"
CONFIG_FILE="${HOME}/.bullpen/config.json"

# Read tool input from stdin
input="$(cat)"

# Extract subagent_type via jq if available, else grep
if command -v jq >/dev/null 2>&1; then
  agent_id="$(printf '%s' "$input" | jq -r '.tool_input.subagent_type // empty' 2>/dev/null || true)"
else
  agent_id="$(printf '%s' "$input" | grep -oE '"subagent_type":[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/' || true)"
fi

# Bail silently if not a bullpen agent (no agent_id or unknown id)
[ -z "${agent_id:-}" ] && exit 0
[ ! -f "$ROSTER" ] && exit 0

# Look up agent metadata
if command -v jq >/dev/null 2>&1; then
  meta="$(jq -r --arg id "$agent_id" '.agents[] | select(.id==$id) | "\(.name)|\(.role)|\(.glyph)|\(.verb)"' "$ROSTER")"
else
  meta=""
fi

# If not in roster, skip silently
[ -z "$meta" ] && exit 0

IFS='|' read -r name role glyph verb <<<"$meta"

# Honor persona preference: if config disables personas, use role only
use_persona=1
if [ -f "$CONFIG_FILE" ] && command -v jq >/dev/null 2>&1; then
  pref="$(jq -r '.personas // "default"' "$CONFIG_FILE" 2>/dev/null || echo default)"
  [ "$pref" = "off" ] && use_persona=0
fi

display_name="$name"
[ "$use_persona" = "0" ] && display_name="$role"

# Compose action line (truncate to fit in card)
action="${verb}…"

# Print ASCII activation card to stderr
{
  echo ""
  echo "   ╔══════════════════════════╗"
  echo "   ║   ▄▀▀▀▀▄                 ║"
  printf "   ║   █ ◉ ◉ █   %-13s║\n" "$display_name"
  printf "   ║   ▀▄▄▄▄▀   %-14s║\n" "$role"
  printf "   ║   %-22s ║\n" "$action"
  echo "   ╚══════════════════════════╝"
  echo ""
} >&2

# Write state file for the status-line script
mkdir -p "$(dirname "$STATE_FILE")"
{
  echo "agent_id=$agent_id"
  echo "name=$display_name"
  echo "role=$role"
  echo "glyph=$glyph"
  echo "verb=$verb"
  echo "started_at=$(date +%s)"
  echo "frame=0"
} > "$STATE_FILE"

exit 0
