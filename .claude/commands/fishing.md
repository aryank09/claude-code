---
description: Launch the terminal fishing game (dev copy of the fishing plugin's command)
allowed-tools: Bash(./plugins/fishing/scripts/setup-fishing.sh:*)
---

Run the setup script and inspect its output:

!`./plugins/fishing/scripts/setup-fishing.sh`

The script prints `SAVE_DIR`, `GAME_PATH`, and `NODE_VERSION` on success, or an `ERROR` line on failure.

If it failed (missing Node.js, or missing game files):
- Explain the specific error from the script output.
- If Node.js is missing, tell the user to install Node 16+ and try `/fishing` again.
- Do not attempt to fix this yourself; this is an environment issue for the user to resolve.

If it succeeded, tell the user something like the following (fill in the real `GAME_PATH` from the script output — it is already an absolute path):

---

🎣 **Terminal Tackle is ready.**

This is a real-time game with animation and keyboard input, so it needs to run in an actual terminal window rather than inside this chat. Open a terminal and run:

```bash
node "GAME_PATH_HERE"
```

**Controls:**
- `SPACE` — cast your line, and later tap/hold it to reel in a biting fish
- `Q` or `Ctrl+C` — quit anytime (progress is saved automatically)

Your gold, gear, and catch collection are saved globally at `SAVE_DIR_HERE`, so progress carries across every project.

Good luck out there. 🐟

---

Keep your own message concise and friendly. Do not run the game yourself with Bash — it requires an interactive TTY that tool execution does not provide, so it must be launched by the user in their own terminal.
