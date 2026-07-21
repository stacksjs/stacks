---
title: Contribution Guide
description: Set up Stacks locally, make focused changes, and submit verified contributions.
---
# Contribution Guide

Fork the repository, create a focused branch, and install the workspace with Bun 1.3 or newer.

```bash
bun install
./buddy doctor
```

Read `AGENTS.md` and the relevant skill under `.claude/skills/` before changing a subsystem. Stacks uses TypeScript, STX templates, Crosswind utilities, and Pickier.

Before submitting a change, run the relevant tests plus the repository quality checks:

```bash
./buddy test
bunx --bun pickier .
```

Use a small conventional commit and explain the root cause, behavior change, and verification in the pull request. Do not commit generated secrets, local databases, or unrelated formatting changes.
