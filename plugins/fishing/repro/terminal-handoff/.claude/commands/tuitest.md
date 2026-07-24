---
description: Repro trigger for the terminal-handoff issue (does not reach the model)
---

This command exists only so that typing `/tuitest` is recognized as a command
and fires the `UserPromptExpansion` hook. The hook blocks the expansion before
it reaches Claude, and attempts (and fails) to launch an interactive TUI in the
same terminal. See the repro README for details.
