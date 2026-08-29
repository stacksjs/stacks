---
title: "Browse skill"
description: "Use for headless browser QA on Stacks applications."
---
# Browse

`stacks-browse` · Engineering craft · model-invoked

Headless browser QA with nothing to install. It drives a Chromium-family browser
already on the machine over the Chrome DevTools Protocol using only Bun, so
navigation, screenshots, responsive checks, console and network monitoring and
accessibility snapshots all work without Playwright or Puppeteer.

## When to reach for it

- Navigation
- Screenshots
- Responsive testing
- console/network monitoring
- Accessibility snapshots. Dependency-free
- Driving a system browser over the Chrome DevTools Protocol using only Bun (no Playwright/Puppeteer)

## Inside the skill

The sections an agent reads once the skill loads.

- Browser discovery (no install step)
- Default Stacks dev URLs
- Commands
- Stacks-Specific QA
- Rules
- Extending

## Supporting files

Reference and scripts the skill reaches for on demand, rather than loading up front.

- [`scripts/browse.ts`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-browse/scripts/browse.ts)

## Related skills

- [Retro](/skills/craft/retro)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-browse
```

Source: [`stacks-browse/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-browse/SKILL.md).
Shadow it for one project with `app/Skills/stacks-browse/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
