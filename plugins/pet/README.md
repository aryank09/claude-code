# Terminal Pet 🐾

A Tamagotchi-style virtual pet that lives in your Claude Code **status line**.
It's happy while you're working and slowly gets hungry, then sad, then sick
when you stop using the terminal — and if you neglect it long enough, it dies.

Everything runs locally. **It never calls the model and costs zero API tokens.**

```
🐾 Pixel (◕ᴗ◕) ✧ thriving
♥♥♥♥♥ 100% · fed just now
```

## How it works

Claude Code gives plugins exactly one always-visible, live surface: the
[status line](https://code.claude.com/docs/en/statusline). It re-renders as you
work and on a timer, and it runs a local script with **no API cost**. A pet is a
perfect fit because it's *ambient and time-based* rather than interactive.

Three small pieces, all local Node scripts:

| Piece | Trigger | Job |
| --- | --- | --- |
| `scripts/statusline.js` | status line refresh (and every `refreshInterval` seconds) | draw the pet, apply time decay, record a death once it happens |
| `scripts/feed.js` | `UserPromptSubmit` hook | "using the terminal" — records the interaction that keeps the pet alive. Prints nothing (so it never adds tokens) |
| `scripts/pet-cmd.js` | `UserPromptExpansion` hook on `/pet` | handles `/pet` subcommands offline and blocks the expansion so nothing reaches the model |

State lives in `~/.claude-pet/state.json` and is shared across all your Claude
Code sessions, so it's one pet no matter how many terminals you have open.

### Why it can genuinely "die"

Health is derived from the time since your last interaction. To stop the pet
from being silently resurrected the instant you return, both the feed hook and
the status line enforce the death threshold *before* treating your return as a
feeding: if you were away past the limit, the pet dies now and stays dead until
you `/pet revive`.

## Life stages (the "sensible amount of time")

Time since your last interaction drives the mood. Defaults:

| Stage | Time since last activity | Face |
| --- | --- | --- |
| thriving | < 5m | `(◕ᴗ◕)` |
| content | 5–15m | `(・ᴗ・)` |
| hungry | 15–30m | `(・﹏・)` |
| lonely | 30–60m | `(╥﹏╥)` |
| sick | 1–2h | `(×﹏×)` |
| **gone** | > 2h | `(✝︿✝)` |

So active work keeps it thriving, a short coffee break leaves it hungry (easily
revived by just working again), and a couple hours of total silence will end it.

**Tune it:** edit the `STAGES` array at the top of
[`lib/pet.js`](lib/pet.js). All values are in seconds; the last stage's `until`
is the death threshold.

## Commands

```
/pet             check on your pet (status card)
/pet feed        give it attention right now
/pet rename <n>  rename your pet
/pet revive      adopt a fresh pet after yours has died
/pet help        usage
```

## Install (project-local)

This repo is already wired via `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /absolute/path/to/plugins/pet/scripts/statusline.js",
    "padding": 1,
    "refreshInterval": 5
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node ${CLAUDE_PROJECT_DIR}/plugins/pet/scripts/feed.js", "timeout": 10 }] }
    ],
    "UserPromptExpansion": [
      { "matcher": "pet", "hooks": [{ "type": "command", "command": "node ${CLAUDE_PROJECT_DIR}/plugins/pet/scripts/pet-cmd.js", "timeout": 10 }] }
    ]
  }
}
```

The `/pet` command is registered by `.claude/commands/pet.md`.

Reload Claude Code (settings apply on your next interaction) and your pet
appears above the prompt. Restart is needed the first time so the status line
and hooks load.

### Use it everywhere (user-level)

Point the same `statusLine`/`hooks` entries at absolute paths from your
`~/.claude/settings.json` instead of the project settings, and the pet follows
you into every project.

## Notes & limits

- `refreshInterval` (seconds) is what makes the pet visibly age while you sit
  idle. Lower it for snappier decay, raise it to spawn fewer processes.
- The status line hides during autocomplete, the help menu, and permission
  prompts — that's Claude Code behavior, not the pet.
- Colors use ANSI; set `NO_COLOR=1` to disable them in the status line.
- Requires Node.js (uses only built-ins — no `npm install`).

## Testing

All logic is pure and time-parameterized, so you can test without a live
session by piping mock JSON:

```bash
# render the pet
echo '{}' | node scripts/statusline.js

# simulate neglect by editing ~/.claude-pet/state.json's last_fed, then re-render
```
