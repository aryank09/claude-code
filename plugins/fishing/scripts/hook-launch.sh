#!/bin/bash

# Fishing Plugin - UserPromptExpansion hook
#
# Fires the moment the user types /fishing, before Claude Code expands it
# into a prompt for Claude. Blocking it here means /fishing never reaches
# the model - zero tokens, zero API latency, for a command that's really
# just "print me the launch instructions."
#
# Why the hook can't just launch the game itself: hooks (and their children)
# run in their own session with no controlling terminal as of Claude Code
# v2.1.139. A game launched directly from here renders for a bit but then
# dies with `write EIO` because it never truly owns the tty, and keystrokes
# arrive out of order. (A wrapper that starts Claude Code and drives job
# control was also prototyped and rejected: nested job control fails to
# render Claude Code, and as a top-level process `fg` can hang the terminal
# outright - strictly worse than a two-key manual suspend.) So the game is
# launched by the user, and the reliable same-window path is Ctrl+Z / fg.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
GAME_PATH="${PLUGIN_ROOT}/src/game.js"
SAVE_DIR="$HOME/.claude-fishing"
mkdir -p "$SAVE_DIR" 2>/dev/null

# Always exits 0 with a block decision: /fishing should never be forwarded
# to Claude as a prompt, whatever happens (success, missing Node, etc).
json_block() {
  printf '{"decision":"block","reason":"%s"}\n' "$1"
  exit 0
}

if [[ ! -f "$GAME_PATH" ]]; then
  json_block "Fishing plugin files not found at $GAME_PATH. Try reinstalling the plugin."
fi

if ! command -v node >/dev/null 2>&1; then
  json_block "Node.js 16+ is required to play. Install it, then try /fishing again."
fi

GAME_PATH_ESC="${GAME_PATH//\"/\\\"}"
REASON="🎣 Terminal Tackle is ready.\n\nThis is a real-time game with animation and keyboard input, so it needs to run as its own foreground process rather than through this hook.\n\nFastest way, same window: press Ctrl+Z to suspend Claude Code, run the command below, then run 'fg' when you are done to bring Claude Code back exactly where you left it.\n\n  node \\\"$GAME_PATH_ESC\\\"\n\n(Or just open a new terminal tab and run that same command there.)\n\nControls: SPACE cast/reel  ·  S shop  ·  Q quit (progress autosaves)\nSave file: $SAVE_DIR/save.json"
json_block "$REASON"
