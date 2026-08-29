---
name: stacks-handoff
description: Compact the current conversation into a portable handoff document for another agent or session to pick up.
disable-model-invocation: true
argument-hint: "What will the next session be used for?"
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Handoff

Write a handoff document summarising the current conversation so a fresh agent
can continue the work. Save it to the OS temp directory, not the workspace: a
handoff is scaffolding for one hop, and a stray `HANDOFF.md` in the repo is
sediment.

If the user passed an argument, treat it as a description of what the next
session will focus on and tailor the document to that.

Credit: adapted from Matt Pocock's `handoff` skill (MIT),
<https://github.com/mattpocock/skills>.

## What goes in

- **The goal**, in one paragraph. What the next session is trying to achieve.
- **Where things stand.** What is done, what is in flight, what is untouched.
- **The decisions already made, and why.** This is the part a summary of the
  diff cannot recover, so it is the part worth the most words.
- **What is known to be broken or unverified.** Name the command that would
  prove it either way.
- **Suggested skills.** Name which `stacks-*` skills the next agent should call
  the Skill tool for. A handoff that does not point at `stacks-orm` before a
  model change is handing over a landmine.
- **Open questions** the next session has to resolve, or take back to the user.

## What stays out

Do not duplicate content already captured elsewhere. Reference it by path,
branch, URL or commit instead:

- Committed code and its diff.
- A spec, plan or ADR already written to disk.
- An issue or PR on the tracker.
- Anything a `stacks-*` skill already documents. Point at the skill.

## Redact before you write

The document leaves this session, so treat it as publishable. Write
`<REDACTED>` in place of:

- Anything from `.env`, `.env.production` or `config/services.ts`.
- `APP_KEY`, AWS keys, `HCLOUD_TOKEN`, registrar and DNS API tokens, database
  URLs with credentials in them.
- Personal data pulled out of a database during the session.

Reference the variable name and where it lives, never the value.

## Finish

Tell the user the absolute path, and say in one line what the next session
should do first.

## Before you hand off at all

A handoff is narrow. It buys **portability**, and you only need it when
something is actually travelling: a different agent, a different directory or
repo, a colleague, or a side task forked mid-phase. If none of those apply, the
cheaper moves are to continue, to clear, or to compact. `stacks-flow` has the
ordered tree.
