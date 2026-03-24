---
name: stacks-retro
description: Use for git-based session retrospectives — session detection, commit categorization, focus scores, streak counting, and behavioral observations. Invoke with /stacks-retro.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-retro — Session Retrospective

Generate a retrospective analysis of recent development work based on git history.

## Step 1: Session Detection

Detect sessions using a **45-minute gap threshold** between commits.

```bash
git log --all --format="%H|%ai|%an|%s" --since="7 days ago"
```

Adjust `--since` if user specifies a range ("today", "this week", etc.).

## Step 2: Commit Categorization

| Category | Indicators | Icon |
|----------|-----------|------|
| Feature | `feat:`, new files, new exports | 🟢 |
| Fix | `fix:`, corrective changes | 🔴 |
| Refactor | `refactor:`, structural changes | 🔵 |
| Test | `test:`, test file changes | 🟡 |
| Docs | `docs:`, README changes | 📝 |
| Chore | `chore:`, deps, config, CI | ⚙️ |
| Style | `style:`, formatting, lint | 🎨 |

Parse `gitlint`-style conventional commit prefixes. Stacks uses these scopes: `core`, `auth`, `database`, `router`, `buddy`, `ui`, `build`, etc.

## Step 3: Session Analysis

### Focus Score (0-100)
```
focus_score = (commits_in_primary_area / total_commits) × 100
```

Primary area = most-touched `storage/framework/core/*/` package or top-level directory.

- **80-100**: Deep focus
- **50-79**: Moderate focus
- **0-49**: Scattered

```
### Session [N]: [start] → [end] ([duration])
**Focus**: [score]/100 — [assessment]
**Primary area**: [package/directory]
**Commits**: [count]

| Time | Category | Message | Files |
|------|----------|---------|-------|

**Observation**: [one behavioral insight]
```

## Step 4: Streaks

```bash
git log --all --format="%ad" --date=short | sort -u
```

```
## Streaks
🔥 Current streak: [N] days
📈 Longest streak: [N] days ([range])
📅 Active days: [N] / [total]
```

## Step 5: Per-Contributor Metrics (if multiple)

```
| Contributor | Commits | Primary Focus | Top Category | Avg Focus |
|-------------|---------|---------------|--------------|-----------|
```

## Step 6: Behavioral Observations

2-4 observations backed by data:

- "You wrote 12 fix commits after the auth refactor — consider adding tests before next refactor session."
- "Focus score drops in afternoon sessions. Morning sessions average 85."
- "No test commits this week despite 8 feature commits. Test debt accumulating."
- "3/4 sessions started with chore commits. Consider batching into a maintenance session."

## Output

```
# Retrospective: [date range]

## Overview
- **Period**: [range]
- **Sessions**: [count]
- **Total commits**: [count]

## Category Breakdown
[icons and counts]

## Sessions
[session details]

## Streaks
[streak data]

## Observations
[behavioral insights]

## Suggested Focus for Next Session
[one specific suggestion]
```

## Rules

- **Data-driven only.** Every observation backed by commits/metrics.
- **No judgment on work hours.** Don't comment on when someone works.
- **Default to 7 days** if no range specified.
- **Handle messy history gracefully.** Squash/merge/rebase can distort sessions.
