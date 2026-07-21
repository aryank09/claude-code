# Fishing Plugin

A Stardew Valley-inspired ASCII fishing game for your terminal. Take a break with `/fishing` while Claude Code works, or just because you want to catch a few fish.

## Quick Start

```
/fishing
```

Because this is a real-time game with live animation and keyboard input, it needs an actual TTY (terminal), which a Claude Code command's tool execution does not provide. Running `/fishing` prepares everything and gives you a one-line `node` command to paste into your own terminal window.

## Controls

- `SPACE` - cast your line; once a fish bites, mash or hold it to reel the catch zone up onto the fish
- `S` - open the tackle shop from the idle fishing screen
- `B` / `Escape` - back out of the shop
- `Q` / `Ctrl+C` - quit anytime; progress is saved automatically before every state change

## How It Works

- **Cast** and wait - the wait time before a bite is randomized.
- **Reel it in** - a vertical "catch zone" that you control fights gravity while a fish swims around semi-randomly. Keep the zone overlapping the fish to fill the catch meter before it drains to zero or you tire out.
- **Catch or escape** - land the fish for gold and a spot in your collection, or watch it swim away and try again.

Difficulty (fish swim speed/erraticism and catch-zone size) scales with each species' rarity, so legendary fish are still a real challenge - the catch mechanic rewards actively tracking the fish, not just spamming the key.

## Resizing

Every screen shares one box width derived live from your terminal's current column count, so resizing your terminal window makes the whole game bigger (or smaller) on the very next frame - no restart needed. It's clamped between a comfortable minimum and a maximum so the box never gets uncomfortably cramped or awkwardly stretched. The vertical "lake" scene also gains a few extra water rows on taller terminals.

The minigame's internal catch-zone/track proportions are intentionally **not** resized with the window - only the surrounding box gets wider - so the reel-in difficulty is identical no matter how big your terminal is. If you shrink the window below the minimum, the game pauses gameplay rendering and shows a short "resize to keep playing" message instead of corrupting the layout; it resumes automatically once you size back up.

## The Tackle Shop

Press `S` on the idle fishing screen to spend gold on better gear:

- **Rods** widen your catch zone (`barBonus`), making every fish easier to land. Bamboo (starter) → Fiberglass (150g) → Graphite (400g).
- **Bait** shifts the odds toward rarer fish (`rarityBoost`) on your next bite. Worm (starter) → Shiny Lure (80g) → Premium Lure (250g).

Buying a tier equips it immediately; there's no separate inventory to manage. Rod/bait tiers are defined in `src/data/gear.json`, so adding a new one is just a new entry in that file (the shop menu numbering and purchase logic pick it up automatically).

## Progress & Saves

Your gold, equipped rod/bait, and fish collection are saved globally at `~/.claude-fishing/save.json`, so progress carries across every project you use Claude Code in.

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
    │   ├── layout.js             # terminal-size-aware shared box width + centering
    │   ├── save.js              # save file read/write
    │   ├── rng.js                # fish selection, weight/value rolls, bite timing
    │   └── gear.js               # rod/bait catalog lookups (backed by data/gear.json)
    ├── screens/
    │   ├── title.js
    │   ├── fishing.js            # idle / waiting / bite states
    │   ├── minigame.js           # the reel-in mechanic (physics + render)
    │   ├── reveal.js             # catch card / escape card
    │   └── shop.js               # tackle shop - buy/equip rods & bait
    └── data/
        ├── fish.json             # fish species database
        └── gear.json             # rod/bait tiers, cost, and bonuses
```

Why a "launcher" pattern instead of running the game directly from the command? Claude Code executes command bash (`` !`...` ``) non-interactively and captures stdout as text - there's no real TTY handed to that process. A live game with raw-mode keypresses and an animation loop needs an actual terminal, so `/fishing` only prepares the environment and prints the exact command to run.

## Roadmap Ideas (not built yet)

- Additional locations with unique fish and ASCII scenery
- A fish collection ("Pokédex") screen
- Weather effects on bite rates

## Requirements

- Node.js 16+
- A terminal at least 62x24 (bigger terminals just make the game bigger - see "Resizing" above)
