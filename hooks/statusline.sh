#!/usr/bin/env bash
# bullpen — status line renderer
# Reads the active agent state file (if any) and outputs a single-line
# string for Claude Code's statusLine. Animates dots based on a frame
# counter that increments on each refresh.
#
# Zero LLM cost — runs locally on each status-line tick.

set -euo pipefail

STATE_FILE="${TMPDIR:-/tmp}/bullpen-status"

# No state? Print nothing (Claude Code shows its default).
if [ ! -s "$STATE_FILE" ]; then
  exit 0
fi

# Source the state file (key=value lines)
# shellcheck disable=SC1090
. "$STATE_FILE" 2>/dev/null || exit 0

# Build dot animation
frame="${frame:-0}"
case $((frame % 4)) in
  0) dots=" .  .  ." ;;
  1) dots=" .  .   " ;;
  2) dots=" .      " ;;
  3) dots="        " ;;
esac

# Increment frame in state file (best-effort; ignore if file gone)
if [ -f "$STATE_FILE" ]; then
  next=$((frame + 1))
  sed -i.bak -E "s/^frame=.*/frame=${next}/" "$STATE_FILE" 2>/dev/null || true
  rm -f "${STATE_FILE}.bak" 2>/dev/null || true
fi

# Compose output
display_name="${name:-agent}"
role_text="${role:-}"
verb_text="${verb:-working}"
glyph_text="${glyph:-[?]}"

printf '%s %s (%s) is %s%s' "$glyph_text" "$display_name" "$role_text" "$verb_text" "$dots"
