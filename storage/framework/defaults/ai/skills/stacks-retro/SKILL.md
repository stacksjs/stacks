---
name: stacks-retro
description: Use for a retrospective on Stacks work - proposing concrete improvements to the agent's environment (navigation pointers, automated checks, AGENTS.md, skills, tool economy) from what actually went wrong, backed by git-derived session data. Invoke with /stacks-retro.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-retro - session retrospective

A retrospective here is not a report card. You are proposing improvements to the
**environment** the next session runs in, so that the mistakes this session made
become impossible or cheap to catch. Pass 1 finds the improvements. Pass 2 backs
them with data from git.

Call the Skill tool with `stacks-writing-for-agents` before proposing any change
to a document. Half the candidates below are edits to files agents read, and a
retro that adds sediment to `AGENTS.md` has made things worse.

Credit: the environment-improvement framing is adapted from Matt Pocock's `retro`
skill (MIT), <https://github.com/mattpocock/skills>.

## Pass 1: environment improvements

### Read the primary sources

Read the session the user names, defaulting to the current one. Where the session
is not in context, reconstruct it from the diff, the commits, and any session
logs on this machine. Work from what actually happened, not from a summary.

### Look for candidates in these categories

- **Navigation.** How easy was it to find the right file? Are there hidden
  dependencies between files? Would a **navigation pointer** in `AGENTS.md`, or a
  `Key paths` block in the relevant skill, have shortened it? *Use when* the
  session spent a long time hunting for one piece of information.
- **Automated checks.** Could a check have caught this mistake? `pickier` rules,
  a type, a test, a contract test in `tests/unit/`, a `buddy` command that
  validates a registry. *Use when* the agent made a mistake a machine could have
  caught. This is the strongest category, because a check does not depend on
  anyone reading anything.
- **Coding standards.** Should the review get a new rule to enforce, or should an
  existing one be removed or clarified? *Use when* `/stacks-review` missed
  something it should have caught.
- **AGENTS.md.** Are there steering instructions that belong in a check or a
  skill instead? Is anything in it a **no-op**, an instruction the model already
  obeys by default? *Use when* the file is large and unwieldy, in the repo or in
  the user's global scope.
- **Skills.** Did the agent guess at an API a skill documents? Then the skill's
  **description** is the bug, not its body: the pointer did not fire. Did the
  agent read a skill and still get it wrong? Then the body is the bug. Did the
  work touch a subsystem with no skill? That is a new one under `app/Skills/`.
- **Tool economy.** Did the agent make expensive calls that could be streamlined?
  Is a custom command or MCP server particularly token-inefficient? *Use when*
  one call dominated the session.
- **Information access.** Could the agent have been given more? Teeing
  `buddy dev` output to a file it can read, `storage/logs/stacks.log`, read-only
  access to a dashboard or a third-party console. *Use when* a crucial fact was
  simply not reachable.
- **Generated artifacts going stale.** Did the session trip over
  `storage/framework/types/*.d.ts`, an auto-import manifest, or a migration that
  no longer matched its model? The fix is usually a check that regenerates and
  diffs in CI, not a line asking someone to remember.

### Present them

In order of severity, each as: what happened, which category, the specific change
to make, and where it goes. Be concrete. "Add a note about migrations" is not a
candidate. "Add a contract test in `tests/unit/` that fails when
`database/types.d.ts` is missing a table any migration creates" is.

Ask before writing any of them.

## Pass 2: the data

Back the observations with git rather than impressions.

### Session detection

Detect sessions with a **45-minute gap threshold** between commits.

```bash
git log --all --format="%H|%ai|%an|%s" --since="7 days ago"
```

Adjust `--since` for the range the user asked for. Default to 7 days.

### Commit categorization

| Category | Indicators | Icon |
|---|---|---|
| Feature | `feat:`, new files, new exports | 🟢 |
| Fix | `fix:` | 🔴 |
| Refactor | `refactor:` | 🔵 |
| Test | `test:`, test file changes | 🟡 |
| Docs | `docs:`, README changes | 📝 |
| Chore | `chore:`, deps, config, CI | ⚙️ |
| Style | `style:`, formatting, lint | 🎨 |

Parse the conventional-commit prefixes and the scopes from `config/git.ts`.

### Focus

```
focus = (commits in the primary area / total commits) × 100
```

The primary area is the most-touched `storage/framework/core/*/` package or
top-level directory. 80+ is deep focus, 50 to 79 is moderate, below 50 is
scattered.

```
### Session [N]: [start] to [end] ([duration])
**Focus**: [score]/100
**Primary area**: [package or directory]
**Commits**: [count]

| Time | Category | Message | Files |
|---|---|---|---|
```

### Signals worth reading

A pattern in the data is only interesting when it points at a Pass 1 candidate:

- A run of `fix:` commits after one `refactor:` is a missing check or a missing
  test at that seam.
- Feature commits with no test commits is accumulating debt with a name and a
  location.
- Repeated chore commits at the start of every session is a setup step that wants
  automating.
- A low focus score across a week where each session is individually focused is
  usually a navigation problem, not a discipline one.

## Output

```
# Retrospective: [range]

## Improvements
[candidates, most severe first, each with its category and the exact change]

## Data
- Period, sessions, commits
- Category breakdown
- Sessions and focus
- Signals

## Next session
[one specific suggestion]
```

## Rules

- **Every observation is backed by a commit, a diff or a log line.** No vibes.
- **Propose environment changes, not personal ones.** No comment on when someone
  works or how fast.
- **Prefer a check to a sentence.** A rule nobody reads is a rule that does not
  exist.
- **Deleting counts.** A no-op line removed from `AGENTS.md` is as good a
  candidate as a new one added.
- **Handle messy history gracefully.** Squash, merge and rebase distort session
  boundaries. Say so rather than inventing precision.

## Downstream

> Candidate accepted? `/stacks-writing-for-agents` for anything that lands in a
> document, `/stacks-tdd` for anything that lands as a test.
