# Repro: no terminal handoff for interactive TUIs launched from hooks/commands

**Environment:** Claude Code 2.1.216 · macOS (darwin 25.5.0) · Node 16+
**Component:** hooks (`UserPromptExpansion`) / slash commands · terminal / job control

## One-line summary

There is no supported way for a Claude Code hook or slash command to hand the
controlling terminal to an interactive, full-screen subprocess (raw-mode input +
its own render loop) and reclaim it when that subprocess exits. This blocks any
plugin that *is itself* an interactive terminal program (a game, an `fzf`-style
picker, a TUI wizard, etc.).

## What I'm trying to do

Type a slash command (e.g. `/tuitest`) and have it launch an interactive TUI in
the same terminal, then return to Claude Code when the TUI exits — no manual
steps.

## The core constraint (documented, and I believe intentional)

From the hooks reference:

> On macOS and Linux, command hooks run in their own session without a
> controlling terminal as of v2.1.139. The hook process and any child processes
> can't open `/dev/tty` or send escape sequences directly to the Claude Code
> interface.

So a hook — and anything it spawns — is deliberately detached from the
terminal's session/controlling TTY.

## What already works (so the gap is narrow)

1. **Blocking the command with zero model cost.** A `UserPromptExpansion` hook
   returning `{"decision":"block"}` intercepts `/tuitest` before it expands into
   a prompt. Instant, no tokens, no API call. 👍
2. **Claude Code's own suspend/resume is solid.** Sending `SIGTSTP` to the
   `claude` PID cleanly suspends it (it prints *"Claude Code has been suspended.
   Run `fg` to bring Claude Code back."*); `SIGCONT` cleanly resumes and redraws.
3. **The manual path works perfectly:** `Ctrl+Z` → run the TUI in the freed
   shell → `fg`. This works precisely because the user's *interactive shell*
   (the real session leader that owns the TTY) brokers the handoff.

The only missing piece is a **programmatic** version of #3.

## What fails, and why (this is what the repro demonstrates)

### Attempt A — hook opens the terminal device directly (this repro)

The hook can't open `/dev/tty`, so it walks up to its parent (`claude`), finds
that process's terminal device (`/dev/ttysNNN`), and opens it by path to run the
TUI. This gets furthest of anything I tried, and the failure is decisive:

- **Reliable (100% of runs): the TUI receives no keyboard input.** Its output
  renders (you see `frame N` scroll by), but keystrokes never reach it, because
  Claude Code keeps its own reader on the terminal active during the hook run
  (for `esc to interrupt`). In my measured run, typing the 5-character string
  `zxvbn` while the TUI was "running" resulted in **zero** bytes reaching the
  TUI (`repro-input.log` never gets created). An interactive program that can't
  read the keyboard is unusable. Input is at best racy: a different run with the
  string `zqxjw` delivered only the single `q` to the TUI.
- **Reliable: the hook has no controlling terminal.** `repro-hook.log` shows
  `controlling tty of hook process ...: not a tty` — it only reaches the
  terminal at all by reaching around to `claude`'s device node.
- **Intermittent: `write EIO`.** Under some timing/load the continuous render
  writes are rejected by the kernel (process is outside the terminal's
  foreground process group / session) and the TUI dies with `write EIO`
  (captured in `repro-crash.log` when it happens).

This repro captures the evidence in `repro-hook.log` (what the hook saw),
`repro-input.log` (which keystrokes, if any, reached the TUI), and
`repro-crash.log` (the `write EIO` signature when it occurs).

### Attempt B — a wrapper that starts Claude Code and drives job control

(Not included here to keep the repro minimal; described for completeness.)
A wrapper launches `claude` as a job-controlled child; the hook drops a sentinel
and `SIGTSTP`s `claude`; the wrapper runs the TUI as a foreground job, then
`SIGCONT`s `claude`.

- Nested under a normal interactive shell (the realistic `alias claude=wrapper`
  case): **Claude Code won't render** — nested job control contends over the
  terminal's foreground process group (`tcsetpgrp`).
- As a top-level process: **`fg` blocked indefinitely and hung the terminal.**

A launcher that can silently hang or blank the session is strictly worse than a
two-key manual suspend, so this is a dead end without support from Claude Code.

## The capability gap

Nothing programmatic can trigger the same terminal handoff the human's
interactive shell performs on `Ctrl+Z`/`fg`. Hooks are (by design) detached from
the TTY, and Claude Code holds the terminal for itself while running.

## Proposed fixes (any one would unblock this)

1. **A "foreground handoff" result for hooks/commands.** Let a hook or command
   return something like:

   ```json
   {
     "decision": "block",
     "runInteractive": { "command": "node", "args": ["/abs/path/game.js"] }
   }
   ```

   …and Claude Code itself suspends its TUI, runs that process attached to the
   real controlling terminal in the foreground, then resumes on exit. This is the
   safe, first-class version of what plugins are currently forced to hand-roll.

2. **A documented, supported trigger for Claude Code's existing suspend.** Expose
   the exact `Ctrl+Z` suspend code path (and a paired resume) programmatically,
   so a wrapper can reliably do suspend → run → resume without racing
   `tcsetpgrp`.

3. **A blessed pattern / clarification for interactive plugins.** Today the docs
   only sanction `systemMessage` and `terminalSequence` (notifications, bell,
   title), which can't host a TUI. If there's an intended pattern for plugins
   that are themselves interactive terminal programs, documenting it would be
   enough.

## How to run this repro

Requires: `claude` on PATH, `node` on PATH, macOS/Linux, `jq` not needed.

```bash
cd plugins/fishing/repro/terminal-handoff
chmod +x hook-launch.sh
rm -f repro-hook.log repro-crash.log repro-input.log

# Sanity check: the TUI works fine when a normal shell owns the terminal.
# Press a few keys (they echo as `key: "..."`), then q to quit. No crash, and
# repro-input.log records every key you pressed.
node fake-tui.js
cat repro-input.log     # shows the keys you just pressed reached the TUI
rm -f repro-input.log

# Now reproduce the failure. Start Claude Code IN THIS DIRECTORY so it picks up
# ./.claude/settings.json, then type:  /tuitest
# Once you see `frame N` lines scrolling, type a few distinctive letters
# (e.g. z x v b n) - do NOT press q or Enter.
claude
```

After typing `/tuitest`, the command is blocked (as intended) and the hook tries
to launch the TUI against Claude Code's terminal device. It renders (`frame N`
lines), but the letters you type do not drive it. Inspect:

```bash
cat repro-hook.log      # hook saw: "not a tty"; had to open claude's device by path
cat repro-input.log     # MISSING or nearly empty: the keys you typed never reached the TUI
cat repro-crash.log     # present only if the intermittent `write EIO` fired this run
```

Expected: `repro-hook.log` confirms the hook has no controlling terminal;
`repro-input.log` shows the TUI received none (or only a racy fraction) of your
keystrokes; and `repro-crash.log` may show a `write EIO` crash. Together this
demonstrates that a hook-spawned interactive program can neither own the terminal
nor reliably read the keyboard.

Compare with the sanity check above, where the identical program run from a
normal shell records every keypress and never crashes.

## Files

| File | Purpose |
| --- | --- |
| `fake-tui.js` | Minimal raw-mode, full-screen program (stands in for any TUI). |
| `hook-launch.sh` | `UserPromptExpansion` hook that blocks `/tuitest` and tries to launch the TUI. |
| `.claude/settings.json` | Wires the hook to the `tuitest` command. |
| `.claude/commands/tuitest.md` | Trivial command so `/tuitest` is recognized. |
| `repro-hook.log` | Generated on run: what the hook saw (no controlling tty, device path). |
| `repro-input.log` | Generated on run: which keystrokes actually reached the TUI (missing/empty = none). |
| `repro-crash.log` | Generated on run: the `write EIO` signature, when the intermittent crash fires. |
