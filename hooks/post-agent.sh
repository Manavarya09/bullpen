#!/usr/bin/env bash
# bullpen — post-agent hook
# Fires after a Task tool call completes. Clears the status-line state
# file, increments wellness counters, and (if Pinecone is configured)
# enqueues a learning-extraction job for the matching intern.
#
# Zero LLM cost in this script itself — the optional learning-extraction
# job runs out-of-band via the bullpen-learn skill, only when the user's
# normal session is idle.

set -euo pipefail

STATE_FILE="${TMPDIR:-/tmp}/bullpen-status"
COACH_FILE="${TMPDIR:-/tmp}/bullpen-coach"
LEARN_QUEUE="${TMPDIR:-/tmp}/bullpen-learn-queue"
ROSTER="${CLAUDE_PLUGIN_ROOT}/scripts/roster.json"

# Read tool result JSON from stdin (we don't strictly need it, but consuming
# stdin avoids broken-pipe noise on the upstream)
input="$(cat || true)"

# If no state file, nothing to clean up
[ ! -f "$STATE_FILE" ] && exit 0

# Pull agent_id before clearing
agent_id="$(grep -E '^agent_id=' "$STATE_FILE" | head -1 | cut -d= -f2 || true)"

# Clear status state
: > "$STATE_FILE"

# Update wellness counters (used by coach-watcher for ship_celebration trigger)
mkdir -p "$(dirname "$COACH_FILE")"
touch "$COACH_FILE"
last_completion="$(date +%s)"

# Detect success vs error from tool_response if jq is present
status="unknown"
if command -v jq >/dev/null 2>&1; then
  is_error="$(printf '%s' "$input" | jq -r '.tool_response.is_error // false' 2>/dev/null || echo false)"
  [ "$is_error" = "true" ] && status="error" || status="ok"
fi

# Append to coach state (last 20 lines kept)
{
  cat "$COACH_FILE" 2>/dev/null || true
  echo "ts=$last_completion agent=$agent_id status=$status"
} | tail -20 > "${COACH_FILE}.tmp"
mv "${COACH_FILE}.tmp" "$COACH_FILE"

# Enqueue learning extraction (intern routing happens in the queue worker)
if [ -n "${agent_id:-}" ] && [ -f "$ROSTER" ]; then
  mkdir -p "$(dirname "$LEARN_QUEUE")"
  echo "$agent_id|$last_completion|$status" >> "$LEARN_QUEUE"
fi

# Soft notification: status-line script will pick up the cleared state
exit 0
