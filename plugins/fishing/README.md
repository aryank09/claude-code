# Fishing Plugin

A Stardew Valley-inspired ASCII fishing game for your terminal. Take a break with `/fishing` while Claude Code works, or just because you want to catch a few fish.

## Quick Start

```
/fishing
```

Because this is a real-time game with live animation and keyboard input, it needs an actual TTY (terminal), which a Claude Code command's tool execution does not provide. Running `/fishing` prepares everything and gives you a one-line `node` command to paste into your own terminal window.

## Controls

- `SPACE` - cast your line; once a fish bites, mash or hold it to reel the catch zone up onto the fish
- `Q` / `Ctrl+C` - quit anytime; progress is saved automatically before every state change

## How It Works

- **Cast** and wait - the wait time before a bite is randomized.
- **Reel it in** - a vertical "catch zone" that you control fights gravity while a fish swims around semi-randomly. Keep the zone overlapping the fish to fill the catch meter before it drains to zero or you tire out.
- **Catch or escape** - land the fish for gold and a spot in your collection, or watch it swim away and try again.

Difficulty (fish swim speed/erraticism and catch-zone size) scales with each species' rarity, so legendary fish are a real challenge even for a skilled player - the catch mechanic rewards actively tracking the fish, not just spamming the key.

## Progress & Saves

Your gold, rod/bait, and fish collection are saved globally at `~/.claude-fishing/save.json`, so progress carries across every project you use Claude Code in.

## Architecture

```
fishing/
├── .claude-plugin/plugin.json   # plugin manifest
├── commands/fishing.md          # /fishing command - prepares & launches the game
├── scripts/setup-fishing.sh     # ensures the save dir exists, resolves the game path
├── package.json                 # no runtime dependencies
└── src/
    ├── game.js                  # entry point: TTY setup, input, game loop, teardown
    ├── engine/
    │   ├── renderer.js          # raw ANSI helpers (no chalk - zero install step)
    │   ├── save.js              # save file read/write
    │   └── rng.js                # fish selection, weight/value rolls, bite timing
    ├── screens/
    │   ├── title.js
    │   ├── fishing.js            # idle / waiting / bite states
    │   ├── minigame.js           # the reel-in mechanic (physics + render)
    │   └── reveal.js             # catch card / escape card
    └── data/fish.json            # fish species database
```

Why a "launcher" pattern instead of running the game directly from the command? Claude Code executes command bash (`` !`...` ``) non-interactively and captures stdout as text - there's no real TTY handed to that process. A live game with raw-mode keypresses and an animation loop needs an actual terminal, so `/fishing` only prepares the environment and prints the exact command to run.

## Roadmap Ideas (not built yet)

- Additional locations with unique fish and ASCII scenery
- A shop to spend gold on better rods/bait
- A fish collection ("Pokédex") screen
- Weather effects on bite rates

## Requirements

- Node.js 16+
- A terminal at least 60x24
