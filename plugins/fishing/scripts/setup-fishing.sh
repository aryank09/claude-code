#!/bin/bash

# Fishing Plugin Setup Script
# Ensures the save directory exists and reports an absolute, copy-pasteable
# path to the game entry point. The game itself needs a real TTY (raw-mode
# stdin, live animation), which the Claude Code command sandbox does not
# provide, so this script only prepares things and hands the user a command
# to run in their own terminal.

set -euo pipefail

SAVE_DIR="$HOME/.claude-fishing"
mkdir -p "$SAVE_DIR"

GAME_PATH="${CLAUDE_PLUGIN_ROOT}/src/game.js"

if [[ ! -f "$GAME_PATH" ]]; then
  echo "ERROR: game entry point not found at $GAME_PATH" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js was not found on PATH. Install Node 16+ to play." >&2
  exit 1
fi

NODE_VERSION="$(node -e 'console.log(process.versions.node)')"

echo "READY"
echo "SAVE_DIR=$SAVE_DIR"
echo "GAME_PATH=$GAME_PATH"
echo "NODE_VERSION=$NODE_VERSION"
