---
title: Contribution Guide
description: Set up Stacks locally, make focused changes, and submit verified contributions.
---
# Contribution Guide

Fork the repository, create a focused branch, and install the workspace with Bun 1.3 or newer.

```bash
bun install
./buddy setup:ai        # wire your AI agent up, if you use one
./buddy doctor
```

Read `AGENTS.md` and the relevant skill before changing a subsystem. The skills
live in `storage/framework/defaults/ai/skills/`, one per subsystem, and
`./buddy setup:ai` exposes them to Claude Code, Codex, Cursor, Copilot or Gemini.
Stacks uses TypeScript, STX templates, Crosswind utilities, and Pickier.

Before submitting a change, run the relevant tests plus the repository quality
checks:

```bash
./buddy test
bunx --bun pickier .
bun run typecheck        # framework internals
bun run typecheck:app    # app/, config/, resources/, routes/
```

Use a small conventional commit and explain the root cause, behavior change, and verification in the pull request. Do not commit generated secrets, local databases, or unrelated formatting changes.
