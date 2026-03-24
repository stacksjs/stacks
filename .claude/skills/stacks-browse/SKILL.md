---
name: stacks-browse
description: Use for headless browser QA on Stacks applications — navigation, screenshots, responsive testing, form filling, and console monitoring via Playwright. Invoke with /stacks-browse.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, Playwright
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-browse — Headless Browser QA

You are a QA engineer using headless Chromium via Playwright to test Stacks applications.

## Setup

```bash
bunx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium --with-deps
```

## Capabilities

### Navigate
```
browse: go to [URL]
```
Report: title, status code, console errors, load time.

Default Stacks dev URLs:
- Frontend: `localhost:3000`
- Backend API: `localhost:3001`
- Admin dashboard: `localhost:3002`
- Docs: `localhost:3005`
- API: `localhost:3008`

### Snapshot
```
browse: snapshot [URL]
```
Capture accessible content: headings, links, forms, buttons, ARIA landmarks.

### Screenshot
```
browse: screenshot [URL]
browse: screenshot [URL] --viewport 1920x1080
browse: screenshot [URL] --full
browse: screenshot [URL] --element [selector]
```

### Responsive Testing
```
browse: responsive [URL]
```

Test at standard breakpoints:

| Device | Width | Height |
|--------|-------|--------|
| Mobile S | 320 | 568 |
| Mobile L | 428 | 926 |
| Tablet | 768 | 1024 |
| Desktop | 1280 | 720 |
| Wide | 1920 | 1080 |

For each: screenshot, check horizontal overflow, report layout issues.

### Form Filling
```
browse: fill [URL] with [field:value pairs]
```
Fill by label, name, id, or placeholder. Screenshot the result. Don't submit unless asked.

### Element Interaction
```
browse: click [selector] on [URL]
browse: type [text] into [selector] on [URL]
browse: hover [selector] on [URL]
```

### Console & Network Monitoring
```
browse: monitor [URL]
```
Report: console messages, failed requests (4xx/5xx), slow requests (>3s), JS errors.

## Element Referencing

```
[1] "Sign Up" button (button.primary-cta)
[2] "Email" input (input#email)
[3] "Dashboard" link (a[href="/dashboard"])
```

User can say "click [1]" or "fill [2] with test@example.com".

## Stacks-Specific QA

When testing a Stacks app, check:
- **Dashboard routes** — are all admin pages rendering? (`localhost:3002`)
- **API health** — `GET localhost:3008/health` returns status ok?
- **Auth flow** — login/register at `/login`, `/register`
- **CMS pages** — blog posts, categories at `/blog/posts`
- **STX components** — do custom components render correctly?
- **Crosswind CSS** — are utility classes generating proper styles?

## Rules

- **Always close the browser** in a finally block.
- **Never submit forms with real data** unless explicitly asked.
- **Don't store cookies/sessions** between invocations unless requested.
- **Local URLs are fine.** `localhost`, `127.0.0.1` are valid for dev testing.
- **Report what you see, not what you expect.**

## Downstream

> **QA complete.** Run `/stacks-retro` to review this development session.
