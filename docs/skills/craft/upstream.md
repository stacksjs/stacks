---
title: "Upstream skill"
description: "Use when a problem found in an app lives in a dependency - find the owning repository from the package name, reproduce and fix it there, release, and prove the fix from an installed version."
---
# Upstream

`stacks-upstream` · Engineering craft · model-invoked

The fix-at-source loop. A defect in a dependency is fixed in the repository that
owns it, released, and consumed as a version, so the app carries a version bump
and nothing else. Every dependency in the stack is homegrown, which is what
makes the rule practical: no vendored tarballs, no shims, no patched copies.

## When to reach for it

- A stack trace or log prefix points into a package rather than the app
- Finding which repository and directory own a package
- Reproducing a defect in isolation, in the owner's own test suite
- Consuming a just-released version past Bun's cached manifest
- Proving a fix from the published package instead of a workspace link

## Inside the skill

The sections an agent reads once the skill loads.

- The loop
- While the fix is in flight
- Owners
- Gotchas

## Related skills

- [Investigate](/skills/craft/investigate)
- [Dependencies](/skills/platform/dependencies)
- [New app](/skills/craft/new-app)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-upstream
```

Source: [`stacks-upstream/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-upstream/SKILL.md).
Shadow it for one project with `app/Skills/stacks-upstream/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).

## Native source verification

The skill has been checked against current source and retained tests. Read its
entrypoint and linked references for the actual contract; summaries here are
discovery pointers. [Native capabilities](/skills/platform/native) maps every
core package and records driver evidence without claiming universal parity.
