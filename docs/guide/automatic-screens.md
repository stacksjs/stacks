---
title: Automatic screens, videos and docs
description: Picture every stx view of an application without writing a list, join the pictures into a walkthrough video, publish both in the docs and keep them current from CI.
---

# Automatic screens, videos and docs

Stacks knows every page your application serves: stx turns each template under `resources/views` into a route. `screensFromViews()` reads that same route table and hands it to `buddy docs:screenshots`, so the command pictures every view without a hand-written list. Add a view and it is captured on the next run. Delete one and its pictures are removed.

One run produces four things:

| Output | Where | What it is |
| --- | --- | --- |
| Pictures | `<outDir>/<screen>/<profile>-<viewport>.png` | One PNG per screen, signed-in role and viewport |
| Films | `<outDir>/film-<viewport>.mp4` | Every captured screen in order, one video per viewport |
| Docs page | The Markdown file you name | The films, then each screen with its address and pictures |
| Manifest | `<outDir>/manifest.json` | Hashes of everything, so CI can tell when a recapture is due |

This page covers the automatic pipeline from start to finish. [Automated screen documentation](/guide/screenshots) is the reference for the capture command itself (profiles, masks, HTTP verification, model fixtures). [User story videos](/testing/story-recordings) records real journeys with clicks and typing; the last section explains when to use which.

## Quick start

You need a running application with synthetic data, and FFmpeg on `PATH` for the films.

**1. Create `config/screenshots.ts`.**

```ts
import { defineScreenshotConfig, screensFromViews } from '@stacksjs/docs/screenshots'

export default defineScreenshotConfig({
  baseUrl: 'http://localhost:3000',
  // Served by the docs site at /screens.
  outDir: 'docs/public/screens',
  coverage: { directories: ['resources/views'] },
  film: true,
  docs: { page: 'docs/screens.md', base: '/screens', title: 'Every screen' },
  pages: screensFromViews(),
})
```

**2. Look at the inventory.** No browser opens.

```sh
./buddy docs:screenshots --list
```

Every view is listed with its id and address. A view whose address carries a parameter, such as `/projects/[id]`, is marked as an explained gap until you give it an example (see [Addresses with parameters](#addresses-with-parameters)).

**3. Capture.**

```sh
./buddy docs:screenshots
```

**4. Read the result.** Open `docs/screens.md` in your docs site, or play `docs/public/screens/film-desktop.mp4`.

**5. Let CI keep it current.** See [Keep it current from CI](#keep-it-current-from-ci).

That is the whole setup for an application whose pages are public. The rest of this page is about the two things most applications add: who is signed in on each screen, and which record a parameterised address shows.

## How a view becomes a screen

`screensFromViews()` asks the stx router for the routes under each view directory. It reads template files and opens no browser, so it is safe to call at the top of a config file. Each route becomes one screenshot page:

| Field | Derived from | Example |
| --- | --- | --- |
| `id` | The route, with separators turned into dashes | `/coaches/plan-builder` becomes `coaches-plan-builder` |
| `path` | The route pattern, parameters in brackets | `/projects/[id]` |
| `title` | The template's `<title>`, or else the route in words | `Coaches / plan builder` |
| `description` | A default sentence naming the title and address | Replace it with a rule when the screen needs explaining |
| `sources` | The template file | `resources/views/coaches/plan-builder.stx` |
| `waitFor` | `body`, unless your defaults say otherwise | |

The root route `/` gets the id `index`. Routes are sorted by code point, so the inventory, the film and the docs page come out in the same order on every machine. Ids are stable: they depend only on the route, never on a title or a translation, so file names survive copy changes.

Because every page lists its template under `sources`, the `coverage` check passes without any exclusions. It still earns its place: it fails the run if someone later replaces the derived list with a hand-written one that misses a view.

To see the raw route table without building pages, call `discoverViews()`:

```ts
import { discoverViews } from '@stacksjs/docs/screenshots'

for (const view of discoverViews())
  console.log(view.id, view.route, view.layout, view.dynamic)
```

Each entry also carries `group` (the first path segment, `home` for the root), `params`, `layout` (the layout the template extends) and `text` (the template source). Rules use these to decide how a screen is captured.

## Rules: change what the defaults get wrong

Three options adjust the derived pages. They apply in this order, each overriding the one before:

1. `defaults`, for every view.
2. `each(view)`, a function called per view.
3. `routes`, keyed by the exact route pattern.

```ts
import { screensFromViews } from '@stacksjs/docs/screenshots'

const pages = screensFromViews({
  defaults: { waitFor: 'main', masks: ['[data-private]'] },
  each: view => view.group === 'admin' ? { profiles: ['admin'] } : { profiles: ['member'] },
  routes: {
    '/settings': { title: 'Account settings', description: 'Change your name, password and notifications.' },
    '/legal/imprint': 'Static legal text; nothing to show.',
  },
})
```

A rule is one of:

- **An object** with any page field: `title`, `description`, `reason`, `path`, `model`, `profiles`, `waitFor`, `prepare`, `ready`, `masks`, `expectedStatus`, `skip`.
- **A string**, which leaves the screen out and records the string as the reason.
- **`false`**, which leaves it out with a generic reason.
- **`undefined`**, which changes nothing. Return it from `each` for views the function has no opinion about.

A screen that is left out stays in the inventory, the manifest and the "Not pictured" section of the docs page. Nothing disappears silently.

A key in `routes` that matches no view fails the run with the route named. That catches a rule left behind after its view was renamed or deleted.

Two more options:

- `extra` appends pages you write in full. Use it for a second state of one address, such as an open dialog or an empty list. Give each an id that no view has.
- `strict: true` fails instead of recording a gap when a parameterised address has no example. Turn it on once every such address is bound, so a new one cannot land without a fixture.

`directories` lists the view directories (default `['resources/views']`), and `root` sets the project root when the config is not run from it.

## Signed-in screens

Most applications show different screens to different people. Declare one profile per role in the config, then let a rule choose the profile for each view.

```ts
import type { ScreenshotContext } from '@stacksjs/docs/screenshots'
import { defineScreenshotConfig, screensFromViews } from '@stacksjs/docs/screenshots'

const baseUrl = 'http://localhost:3000'
const ACCOUNTS: Record<string, string> = { member: 'member@demo.test', admin: 'admin@demo.test' }

function profile(role: string | null) {
  return {
    async prepare({ view }: ScreenshotContext): Promise<void> {
      // Any same-origin document gives access to the origin's storage.
      await view.navigate(`${baseUrl}/api/health`)
      if (!role) {
        await view.evaluate('localStorage.clear()')
        return
      }
      const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ACCOUNTS[role], password: process.env.DEMO_PASSWORD }),
      })
      const { token } = await response.json() as { token: string }
      await view.evaluate(`localStorage.setItem('token', ${JSON.stringify(token)})`)
    },
  }
}

export default defineScreenshotConfig({
  baseUrl,
  outDir: 'docs/public/screens',
  profiles: { visitor: profile(null), member: profile('member'), admin: profile('admin') },
  redactEnv: ['DEMO_PASSWORD'],
  pages: screensFromViews({
    each(view) {
      if (view.route.startsWith('/admin')) return { profiles: ['admin'] }
      if (view.layout === 'layouts/app') return { profiles: ['member'] }
      return { profiles: ['visitor'] }
    },
  }),
})
```

Three things to know:

- **Assign a profile to every view.** A page with no `profiles` is captured once per configured profile. With three roles that triples the run and photographs a sign-in redirect as a failure for the roles that may not see the screen.
- **The view usually says who it is for.** `view.layout` is the layout the template extends (`@extends('layouts/app')`), and `view.text` is the template source, so a rule can look for whatever marker your application uses, for example `view.text.includes('requireAuth(')`.
- **`prepare` runs before every capture.** Sign in through your API once and reuse the token (keep it in a module-level variable); only the storage write needs to repeat. Each profile runs in its own process, so one role's session cannot leak into another's pictures.

Use synthetic accounts from your seeder. Keep passwords in environment variables and list them in `redactEnv`, which removes their values from any error text that reaches the report.

## Addresses with parameters

A route such as `/projects/[id]` has no picture until you say which project. Three ways, from simplest to most flexible:

**A fixed example.** Use a record your seeder always creates with a known slug.

```ts
routes: {
  '/projects/[slug]': { path: '/projects/sample-project' },
}
```

**A resolver.** Look the record up when the capture runs. It receives the fixtures, the model plan and the profile name, may be asynchronous, and must stay on the configured origin.

```ts
routes: {
  '/orders/[id]': {
    path: async () => {
      const orders = await fetch('http://localhost:3000/api/orders').then(response => response.json()) as Array<{ id: number }>
      if (!orders[0]) throw new Error('The demo account has no order')
      return `/orders/${orders[0].id}`
    },
  },
}
```

**A model fixture.** Name the model and supply its record under `fixtures`; the primary key fills `[id]` and named fields fill parameters such as `[slug]`. See [Use models and seeded records](/guide/screenshots#use-models-and-seeded-records).

```ts
routes: {
  '/projects/[id]': { model: 'Project' },
}
```

Until one of these is in place the screen is listed as an explained gap:

```text
projects-id  /projects/[id]  [excluded: Needs a seeded example: give /projects/[id] a concrete path, fixture resolver or model.]
```

`./buddy docs:screenshots --list` prints every gap, so it doubles as the to-do list for full coverage. Never invent an id: a made-up record shows an error page, and the capture then fails on the HTTP status or the readiness check.

## Addresses that redirect

A view that the router redirects elsewhere cannot be pictured at its own address: the capture refuses a screen that lands on a different route, so a sign-in page can never stand in for the screen you asked for. Leave such views out with the reason:

```ts
import { screensFromViews } from '@stacksjs/docs/screenshots'

const redirects: Record<string, string> = { '/dashboard': '/home' }

const pages = screensFromViews({
  each: view => redirects[view.route] ? `Redirects to ${redirects[view.route]}, which has its own picture.` : undefined,
})
```

## When is a screen loaded?

A picture of a spinner documents nothing. The capture waits for the page's `waitFor` selector, then for its `ready` hook to return `true`, then for fonts and visible images. Put both in `defaults` so every derived screen gets them.

A page often draws once before its data requests start, so a single look can pass too early. Require the quiet to last:

```ts
import type { ScreenshotContext } from '@stacksjs/docs/screenshots'

async function ready({ view }: ScreenshotContext): Promise<boolean> {
  return await view.evaluate<boolean>(`(() => {
    const loading = document.readyState !== 'complete' || document.querySelector('.skeleton, [aria-busy="true"]')
    const requests = performance.getEntriesByType('resource').length
    const seen = window.__quiet
    if (loading || !seen || seen.requests !== requests) {
      window.__quiet = { requests, since: Date.now() }
      return false
    }
    return Date.now() - seen.since >= 1500
  })()`)
}
```

The hook is polled every 100 milliseconds until it returns `true` or the page's deadline (`timeoutMs`, 30 seconds by default) passes. A screen that never settles is recorded as failed, with the phase it stopped in.

## The walkthrough video

`film: true` joins the captured screens into one MP4 per viewport: `film-desktop.mp4`, `film-mobile.mp4`, or whatever your viewports are called. Screens appear in inventory order, each held for a moment.

```ts
film: {
  secondsPerScreen: 1.5, // default 2, from 0.2 to 30
  fps: 12,               // default 12, from 1 to 60
  viewports: ['desktop'], // default: every configured viewport
  ffmpeg: '/usr/local/bin/ffmpeg', // default: ffmpeg from PATH
}
```

- The frame is the viewport's size, rounded up to even numbers as H.264 requires. A picture of another size is scaled to fit and padded with white.
- Only captured screens are filmed. Gaps and failures are skipped, so a failed screen never puts a stale picture in the video.
- The film is rebuilt from the whole manifest on every run, including a partial `--only` refresh.
- There is no audio and no pointer. For clicks, typing and transitions, record a [user story](/testing/story-recordings).

If FFmpeg is missing or fails, the pictures and the manifest are still written and the command then fails with FFmpeg's message, so a broken encoder cannot pass unnoticed.

## The docs page

`docs` writes one Markdown page that a reader can scroll: the films first, then every screen grouped by the first segment of its address, each with its description, address and pictures.

```ts
docs: {
  page: 'docs/screens.md', // project-relative Markdown file
  base: '/screens',        // URL the output directory is served from
  title: 'Every screen',
  description: 'Each view of the application, captured automatically.',
}
```

`base` must match where `outDir` is served. BunPress serves `docs/public` at the site root, so `outDir: 'docs/public/screens'` pairs with `base: '/screens'`. If your docs site lives under a path prefix, include the prefix in `base`.

The page ends with a "Not pictured" list: every gap with its reason, and every screen whose last capture failed. Add the page to your docs navigation once (for BunPress, in `config/docs.ts`); it keeps the same path on every run.

The page is generated and carries a marker comment. The command replaces a page that has the marker and refuses to overwrite one that does not, so pointing `docs.page` at a hand-written file by mistake cannot destroy it. It contains no timestamp: when no picture changed, the page's bytes are identical and CI has nothing to commit.

## Rebuild the video and page without recapturing

```sh
./buddy docs:screenshots --publish
```

`--publish` reads the saved manifest, rebuilds the films and the docs page, and updates their hashes. It opens no browser and needs no running application. Use it after changing `film` or `docs` settings, or when a full capture is not worth it for a change that only affects how the output is presented.

Programmatic callers get the same split. A wrapper that captures in batches (one screen per call, to bound browser memory or to retry failures) would otherwise re-encode the films after every batch. Pass `publish: false` to each capture and publish once at the end:

```ts
import { captureScreenshots, publishScreenshots } from '@stacksjs/docs/screenshots'

for (const id of ['home', 'settings', 'projects'])
  await captureScreenshots({ only: [id], publish: false })
await publishScreenshots()
```

Until `publishScreenshots()` runs, the manifest has no films or page, and `--check` fails with "The screen film is missing".

## Deleted and renamed views

A complete run (no `--only`, no `--viewport`) removes the pictures of screens that are no longer in the inventory, and their sections leave the docs page and the films. Only files the previous manifest recorded are removed; anything else in the output directory is left alone.

A renamed view is a deleted view plus a new one: the old pictures go, new ones appear under the new id. Authored pages that link to an old picture need updating by hand, which is a reason to link readers to the generated page rather than to individual files.

## Knowing when a recapture is due

```sh
./buddy docs:screenshots --check
```

`--check` opens no browser and contacts no server. It fails when any of these changed since the last capture:

- the config file, or any file listed in `inputs`
- any view template (each is a `source` of its page)
- the `@stacksjs/docs` version
- a picture, a film or the docs page on disk
- the inventory itself, for example a view was added and never captured

It cannot see a change that leaves all of those untouched, such as a component or a stylesheet that many views share. List such files in `inputs` if you want them to trigger a recapture, or simply recapture on a schedule.

## Keep it current from CI

The job is always the same five steps: start the application with seeded synthetic data, wait until it answers, capture, commit what changed, push. This GitHub Actions workflow does that weekly, on demand, and whenever a view or the config changes:

```yaml
name: Screens

on:
  workflow_dispatch:
  schedule:
    - cron: '0 4 * * 1'
  push:
    branches: [main]
    paths:
      - resources/views/**
      - config/screenshots.ts

permissions:
  contents: write

concurrency:
  group: screens
  cancel-in-progress: true

jobs:
  capture:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
      - run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - run: bun install --frozen-lockfile
      - name: Seed and start the application
        run: |
          ./buddy migrate
          ./buddy seed
          ./buddy dev > app.log 2>&1 &
          for attempt in $(seq 1 120); do curl -fsS http://localhost:3000/ > /dev/null && break; sleep 1; done
      - name: Capture every view
        run: ./buddy docs:screenshots
      - name: Commit the new pictures
        if: always()
        run: |
          git config user.name "Your Name"
          git config user.email "you@example.com"
          git add docs/public/screens docs/screens.md
          git diff --cached --quiet && exit 0
          git commit -m "docs: update screen captures [skip ci]"
          git push
```

Points that decide whether this works in practice:

- **Chrome.** Linux has no system WebKit for Bun WebView, so the capture uses an installed Chrome-family browser. GitHub's Ubuntu image ships one. On your own runner install Chrome and set `BUN_CHROME_PATH`. Set `backend: 'chrome'` in the config so a laptop and CI render alike.
- **Loops.** The commit changes files under `docs/`, which the `paths` filter does not watch, and `[skip ci]` keeps other workflows from running on it. Without one of those the job can trigger itself.
- **Failures still commit.** `if: always()` publishes the screens that did capture. The capture step has already failed the job, so a broken screen stays visible in CI while its last good picture stays out of the docs page.
- **Who commits.** `git config` in the job sets the author. Use the identity your branch protection accepts. To push to a protected branch, check out with a token that may do so.
- **Other CI systems.** The steps are plain shell. On a self-hosted or ReviewOS runner, keep the same order and replace the setup steps with whatever provisions Bun, FFmpeg, Chrome and your database there.

### Repository size

Pictures are binary files, and every changed picture adds its full size to the repository's history. A few habits keep that small:

- Use `backend: 'chrome'`. Headless Chrome renders one pixel per point. System WebKit on a Retina Mac renders two, which makes each PNG roughly three times larger.
- Capture from CI rather than from laptops, so the same machine produces every picture and unchanged screens produce identical bytes. Only changed files are committed.
- Give the demo data fixed dates and values where you can. A screen that prints "today" changes every day.
- Capture the viewports readers need. Two (desktop and phone) is the default; a third adds half again.
- Prefer a weekly schedule plus the path trigger over capturing on every push.

## Screens or stories?

| | `docs:screenshots` with `screensFromViews()` | `docs:stories` |
| --- | --- | --- |
| Covers | Every view, automatically | The journeys you script |
| Shows | Each screen at rest | Clicks, typing and transitions, with a visible pointer |
| Video | A slideshow per viewport | A real recording per journey |
| Viewports | Any number | One per story |
| Maintenance | None for static views; one rule per parameterised address | One scene per step |
| Fails when | A screen errors, redirects or never loads | A step or assertion fails |

Use the screens pipeline for breadth: nothing a user can open goes undocumented. Use stories for the handful of journeys worth watching end to end, such as signing up or paying. They share nothing but the application under test, so run both from the same CI job against the same seeded data and commit both outputs together.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Screenshot rule for a view that does not exist: /x` | A key in `routes` matches no view. The view was renamed or deleted; update or remove the rule. Patterns use brackets: `/x/[id]`, not `/x/:id`. |
| `Dynamic view needs a concrete path or model` | `strict` is on and a parameterised address has no example. Add a `path` or `model` rule for it. |
| `The screen redirected to a different route` | The profile may not see the screen, or the router redirects it. Assign the right profile, or leave the view out with the redirect as its reason. |
| `The screen returned HTTP 404` | The example record does not exist in this database. Seed it, or resolve the id at capture time instead of hard-coding it. |
| `The screen did not become ready before its deadline` | `waitFor` never matched or `ready` never returned `true`. Open the address in a browser as that role; raise `timeoutMs` only if the page is merely slow. |
| A picture shows skeletons or a spinner | The readiness check passed too early. Require a sustained quiet period, as in [When is a screen loaded?](#when-is-a-screen-loaded) |
| Every screen is captured once per role | Views have no `profiles`. Return one from `each`. |
| `FFmpeg is required to film the captured screens` | Install FFmpeg, set `film.ffmpeg`, or remove `film`. The pictures were still saved. |
| `The screen film is missing; capture again` | A capture ran with `publish: false`, or `film` was added after the last capture. Run `./buddy docs:screenshots --publish`. |
| `Refusing to replace a hand-written page` | `docs.page` points at a file the command did not generate. Choose another path or delete the file. |
| `Refusing to overwrite an unowned screenshot` | The output directory holds pictures from another tool under the same names. Use an empty `outDir`. |
| `--check` fails right after a capture in CI | A file listed in `inputs`, or a view, differs between the capture and the check, often a generated file that the build rewrites. Remove it from `inputs`. |
| Pictures differ between a laptop and CI | Different browser engines or pixel densities. Set `backend: 'chrome'` and treat CI's pictures as the published ones. |

## Reference

### `screensFromViews(options?)`

Returns `ScreenshotPage[]` for `pages`.

| Option | Default | Purpose |
| --- | --- | --- |
| `root` | Current directory | Project root |
| `directories` | `['resources/views']` | View directories, relative to the root |
| `defaults` | `{ waitFor: 'body' }` | `waitFor`, `profiles`, `masks`, `prepare`, `ready` and `reason` for every view |
| `each` | None | `(view) => rule`, computed per view |
| `routes` | None | Rules by exact route pattern |
| `extra` | None | Additional hand-written pages |
| `strict` | `false` | Fail on a parameterised address with no example |

### `discoverViews(options?)`

Returns `ViewScreen[]`: `id`, `route`, `source`, `group`, `params`, `dynamic`, `title`, `layout` and `text`. Takes `root` and `directories`.

### Config fields added for publishing

| Field | Type | Purpose |
| --- | --- | --- |
| `film` | `boolean` or `{ secondsPerScreen, fps, viewports, ffmpeg }` | One walkthrough MP4 per viewport |
| `docs` | `{ page, base, title, description }` | The generated documentation page |

The manifest records both: `films` (viewport, file, SHA-256, screen count, duration) and `docsPage` (path, SHA-256). `--check` verifies them when they are configured.
