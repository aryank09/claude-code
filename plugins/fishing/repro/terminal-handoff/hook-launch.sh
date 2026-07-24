#!/bin/bash

# UserPromptExpansion hook that attempts to launch an interactive TUI in place.
#
# This is the "gets furthest" workaround: since the hook cannot open /dev/tty
# (it has no controlling terminal as of Claude Code v2.1.139), it instead walks
# up to its parent - the `claude` process - and opens THAT process's terminal
# device directly by path (/dev/ttysNNN). The TUI then renders for a few
# seconds and takes some input, but:
#
#   * it crashes with `write EIO` once the kernel decides this out-of-session
#     process may no longer write to the terminal, and
#   * keystrokes are contended, because Claude Code keeps its own reader on the
#     terminal active during the hook run (for `esc to interrupt`).
#
# Everything the hook observes is written to repro-hook.log; the TUI's own
# crash signature lands in repro-crash.log.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TUI="$HERE/fake-tui.js"
LOG="$HERE/repro-hook.log"

{
  echo "=== hook fired $(date) PID=$$ PPID=$PPID ==="
  echo "controlling tty of hook process (expect 'not a tty'): $(tty 2>&1)"

  # The terminal device Claude Code itself is attached to.
  TTY_NAME="$(ps -o tty= -p "$PPID" 2>/dev/null | tr -d ' ')"
  TTY_DEV="/dev/${TTY_NAME}"
  echo "Claude Code's tty via PPID=$PPID -> $TTY_DEV"

  if [[ -n "$TTY_NAME" && "$TTY_NAME" != '??' && -c "$TTY_DEV" ]]; then
    echo "launching TUI against $TTY_DEV (watch for write EIO) ..."
    node "$TUI" < "$TTY_DEV" > "$TTY_DEV" 2>>"$LOG"
    echo "TUI process exited rc=$?"
  else
    echo "no usable terminal device found for PPID $PPID"
  fi
  echo "=== hook done $(date) ==="
} >> "$LOG" 2>&1

# Block the expansion so /tuitest never reaches the model (this part works
# perfectly - it is the terminal handoff that does not).
printf '{"decision":"block","reason":"repro: attempted to launch a TUI from the hook. See repro-hook.log and repro-crash.log in the repro folder."}\n'
