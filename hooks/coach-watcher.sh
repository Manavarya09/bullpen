#!/usr/bin/env bash
# bullpen — Coach watcher
# Background daemon. Started on SessionStart, stopped on Stop.
#
# Periodically checks wellness state files and, when triggers fire,
# prints a randomly-selected message from coach-messages.json to
# stderr (visible in terminal, NOT injected into LLM context).
#
# Zero LLM cost — pure local randomization.
#
# Usage:
#   coach-watcher.sh start   # spawn background loop
#   coach-watcher.sh stop    # kill background loop

set -euo pipefail

PIDFILE="${TMPDIR:-/tmp}/bullpen-coach.pid"
SESSION_FILE="${TMPDIR:-/tmp}/bullpen-coach-session"
COACH_FILE="${TMPDIR:-/tmp}/bullpen-coach"
LAST_PING_FILE="${TMPDIR:-/tmp}/bullpen-coach-last"
MSG_FILE="${CLAUDE_PLUGIN_ROOT}/scripts/coach-messages.json"
CONFIG_FILE="${HOME}/.bullpen/config.json"

action="${1:-status}"

is_coach_enabled() {
  [ ! -f "$CONFIG_FILE" ] && return 0  # default on
  if command -v jq >/dev/null 2>&1; then
    [ "$(jq -r '.coach // "on"' "$CONFIG_FILE")" != "off" ]
  else
    return 0
  fi
}

random_message() {
  local trigger="$1"
  [ ! -f "$MSG_FILE" ] && return 0
  if command -v jq >/dev/null 2>&1; then
    local count
    count="$(jq --arg t "$trigger" '.[$t] | length' "$MSG_FILE" 2>/dev/null || echo 0)"
    [ "$count" = "0" ] && return 0
    local idx=$(( RANDOM % count ))
    jq -r --arg t "$trigger" --argjson i "$idx" '.[$t][$i]' "$MSG_FILE"
  fi
}

ping_user() {
  local trigger="$1"
  local now
  now="$(date +%s)"
  # Rate-limit: don't ping more than once per 25 minutes
  if [ -f "$LAST_PING_FILE" ]; then
    local last
    last="$(cat "$LAST_PING_FILE" 2>/dev/null || echo 0)"
    if [ $(( now - last )) -lt 1500 ]; then
      return 0
    fi
  fi
  local msg
  msg="$(random_message "$trigger")"
  [ -z "$msg" ] && return 0
  echo "$now" > "$LAST_PING_FILE"
  {
    echo ""
    echo "   (♡) Sage:  $msg"
    echo ""
    printf '\a' 2>/dev/null || true   # soft terminal bell
  } >&2
}

watch_loop() {
  is_coach_enabled || exit 0
  echo "$(date +%s)" > "$SESSION_FILE"

  # First-commit-of-day greeting (only once per local calendar day)
  local day_marker="${TMPDIR:-/tmp}/bullpen-coach-day-$(date +%Y%m%d)"
  if [ ! -f "$day_marker" ]; then
    touch "$day_marker"
    sleep 5  # let session settle so the greeting feels intentional
    ping_user "first_commit"
  fi

  while sleep 60; do
    is_coach_enabled || continue

    local now
    now="$(date +%s)"

    # Trigger 1: long_session — 2hr+ active
    if [ -f "$SESSION_FILE" ]; then
      local started
      started="$(cat "$SESSION_FILE" 2>/dev/null || echo "$now")"
      local elapsed=$(( now - started ))
      if [ $elapsed -ge 7200 ]; then
        ping_user "long_session"
        # reset session marker so we ping again every 2hr
        echo "$now" > "$SESSION_FILE"
        continue
      fi
    fi

    # Trigger 2: late_night — past 23:00 local
    local hour
    hour="$(date +%H)"
    if [ "$hour" -ge 23 ] || [ "$hour" -le 1 ]; then
      ping_user "late_night"
      continue
    fi

    # Trigger 3: error_streak — 3+ consecutive errors in coach state
    if [ -f "$COACH_FILE" ]; then
      local err_streak
      err_streak="$(tail -3 "$COACH_FILE" | grep -c 'status=error' || true)"
      if [ "$err_streak" -ge 3 ]; then
        ping_user "error_streak"
        # clear marker so we don't spam
        : > "$COACH_FILE"
        continue
      fi
    fi

    # Trigger 4: ship_celebration — recent ok status with no errors recently
    if [ -f "$COACH_FILE" ]; then
      local last_status
      last_status="$(tail -1 "$COACH_FILE" 2>/dev/null | grep -oE 'status=[a-z]+' | cut -d= -f2 || echo none)"
      local recent_errors
      recent_errors="$(tail -5 "$COACH_FILE" | grep -c 'status=error' || true)"
      if [ "$last_status" = "ok" ] && [ "$recent_errors" = "0" ]; then
        # Probabilistic: 1-in-8 chance to celebrate, so it doesn't feel cheap
        if [ $(( RANDOM % 8 )) -eq 0 ]; then
          ping_user "ship_celebration"
        fi
      fi
    fi
  done
}

case "$action" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      exit 0  # already running
    fi
    is_coach_enabled || exit 0
    ( watch_loop </dev/null >/dev/null 2>&1 ) &
    echo $! > "$PIDFILE"
    disown 2>/dev/null || true
    ;;
  stop)
    if [ -f "$PIDFILE" ]; then
      pid="$(cat "$PIDFILE")"
      kill "$pid" 2>/dev/null || true
      rm -f "$PIDFILE"
    fi
    ;;
  status)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "running ($(cat "$PIDFILE"))"
    else
      echo "stopped"
    fi
    ;;
esac

exit 0
