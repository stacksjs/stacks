---
title: Screen documentation
description: Picture every screen of an application from its stx views, join the pictures into a walkthrough video, publish both in the docs and keep them current from CI.
---

# Screen documentation

`buddy docs:screenshots` opens each screen of your application in a real browser, as the person the screen is for, and saves a picture of it per viewport. The list of screens comes from the stx route table, so you do not write or maintain one: add a view and it is captured on the next run, delete one and its pictures are removed.

One run can produce four things:

| Output | Where | What it is |
| --- | --- | --- |
| Pictures | `<outDir>/<screen>/<profile>-<viewport>.png` | One PNG per screen, signed-in role and viewport |
| Films | `<outDir>/film-<viewport>.mp4` | Every captured screen in order, one video per viewport (`film`) |
| Docs page | The Markdown file you name | The films, then each screen with its address and pictures (`docs`) |
| Manifest | `<outDir>/manifest.json` | The inventory, results and SHA-256 hashes, so CI can tell when a recapture is due |

A picture shows a screen at rest. It does not prove that a payment, a consent or a whole journey works. To record a journey with clicks and typing, use [user story videos](/testing/story-recordings); [Screens or stories?](#screens-or-stories) compares the two.

`buddy screenshot <url>` remains the quick way to picture a single page.

## Quick start

You need the application running with synthetic data. Nothing else has to be installed: the browser that takes the pictures also encodes the films.

**1. Create `config/screenshots.ts`.**

```ts
import { defineScreenshotConfig, screensFromViews } from '@stacksjs/docs/screenshots'

export default defineScreenshotConfig({
  baseUrl: 'http://localhost:3000',
  // The docs site serves docs/public at its root, so this is /screens.
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

Every view is listed with its id and address. A view whose address carries a parameter, such as `/projects/[id]`, is marked as an explained gap until you give it an example.

**3. Capture.**

```sh
./buddy docs:screenshots
```

**4. Read the result.** Open `docs/screens.md` in your docs site, or play `docs/public/screens/film-desktop.mp4`.

**5. Let CI keep it current.** See [Keep it current from CI](#keep-it-current-from-ci).

That is the whole setup for an application whose pages are public. Most applications add two things: [who is signed in](#who-is-signed-in) on each screen, and [which record](#addresses-with-parameters) a parameterised address shows.

## The inventory

### From your views

`screensFromViews()` asks the stx router for the routes under each view directory. It reads template files and opens no browser, so it is safe to call at the top of a config file. Each route becomes one page:

| Field | Derived from | Example |
| --- | --- | --- |
| `id` | The route, with separators turned into dashes | `/coaches/plan-builder` becomes `coaches-plan-builder` |
| `path` | The route pattern, parameters in brackets | `/projects/[id]` |
| `title` | The template's `<title>`, or else the route in words | `Coaches / plan builder` |
| `description` | A sentence naming the title and address | Replace it with a rule when the screen needs explaining |
| `sources` | The template file | `resources/views/coaches/plan-builder.stx` |
| `waitFor` | `body`, unless your defaults say otherwise | |

The root route `/` gets the id `index`. Routes are sorted by code point, so the inventory, the films and the docs page come out in the same order on every machine. An id depends only on the route, never on a title or a translation, so file names survive copy changes.

`discoverViews()` returns the raw route table, for inspection or for building pages yourself:

```ts
import { discoverViews } from '@stacksjs/docs/screenshots'

for (const view of discoverViews())
  console.log(view.id, view.route, view.layout, view.dynamic)
```

Each entry also carries `group` (the first path segment, `home` for the root), `params`, `source`, `title`, `layout` (the layout the template extends) and `text` (the template source). Rules read these to decide how a screen is captured.

### Rules

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

- **An object** with any page field: `title`, `description`, `reason`, `path`, `model`, `profiles`, `viewports`, `waitFor`, `prepare`, `ready`, `masks`, `expectedStatus`, `skip`.
- **A string**, which leaves the screen out and records the string as the reason.
- **`false`**, which leaves it out with a generic reason.
- **`undefined`**, which changes nothing. Return it from `each` for views the function has no opinion about.

A screen that is left out stays in the inventory, the manifest and the "Not pictured" section of the docs page. Nothing disappears silently. Leaving a screen out explains an omission; it is not evidence that the screen was looked at.

A key in `routes` that matches no view fails the run with the route named. That catches a rule left behind after its view was renamed or deleted.

Two more options:

- `extra` appends pages you write in full. Use it for a second state of one address, such as an open dialog or an empty list (see [More than one state of a screen](#more-than-one-state-of-a-screen)).
- `strict: true` fails instead of recording a gap when a parameterised address has no example. Turn it on once every such address is bound, so a new one cannot land without a fixture.

`directories` lists the view directories (default `['resources/views']`), and `root` sets the project root when the config is not run from it.

### Written by hand

`pages` is an ordinary array, so you can write some or all of it yourself. Do that when the application under test has no stx views in this repository, or when you want every screen to carry an authored explanation.

```ts
import { defineScreenshotConfig } from '@stacksjs/docs/screenshots'

export default defineScreenshotConfig({
  baseUrl: 'http://localhost:3000',
  outDir: 'storage/screenshots',
  pages: [
    {
      id: 'home',
      title: 'Your home',
      path: '/',
      description: 'See today\'s work and choose what to open next.',
      reason: 'A summary helps returning users resume their work.',
      sources: ['resources/views/index.stx'],
      waitFor: 'main[data-ready="true"]',
    },
  ],
})
```

A page needs `id`, `title`, `path`, `description` and `waitFor`. Ids must be unique and safe as file names. Do not put secrets into ids, titles or descriptions: they are published.

### The coverage check

`coverage.directories` scans `.stx` templates recursively. Every template must be named by a page's `sources` or by an exact, explained exclusion. A derived inventory satisfies this by construction. The check earns its place with a hand-written one, and it guards a derived one against being replaced later by a list that misses a view.

```ts
coverage: {
  directories: ['resources/views'],
  exclude: {
    'resources/views/auth/reset.stx': 'Requires a one-use emailed token; the recovery guide explains this screen.',
  },
},
```

Missing templates, empty coverage directories, stale exclusions, duplicate ids, unknown profiles and invalid viewports all fail validation, in `--list` as well as in a capture.

## Who is signed in

Most applications show different screens to different people. Declare one profile per role, then let a rule choose the profile for each view.

```ts
import type { ScreenshotContext } from '@stacksjs/docs/screenshots'
import { defineScreenshotConfig, screensFromViews } from '@stacksjs/docs/screenshots'

const baseUrl = 'http://localhost:3000'
const ACCOUNTS: Record<string, string> = { member: 'member@demo.test', admin: 'admin@demo.test' }
const tokens = new Map<string, string>()

/** Sign in through the API once per role; every capture reuses the token. */
async function token(role: string): Promise<string> {
  if (!tokens.has(role)) {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ACCOUNTS[role], password: process.env.DEMO_PASSWORD }),
    })
    if (!response.ok) throw new Error(`The demo ${role} could not sign in`)
    tokens.set(role, (await response.json() as { token: string }).token)
  }
  return tokens.get(role)!
}

function profile(role: string | null) {
  return {
    async prepare({ view }: ScreenshotContext): Promise<void> {
      // Any same-origin document gives access to the origin's storage.
      await view.navigate(`${baseUrl}/api/health`)
      await view.evaluate('localStorage.clear()')
      if (role) await view.evaluate(`localStorage.setItem('token', ${JSON.stringify(await token(role))})`)
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

Adapt the endpoint and the storage key to how your application keeps a session.

- **Assign a profile to every screen.** A page with no `profiles` is captured once per configured profile. With three roles that triples the run, and the roles that may not see a screen fail on its sign-in redirect.
- **The view usually says who it is for.** `view.layout` is the layout the template extends (`@extends('layouts/app')`), and `view.text` is the template source, so a rule can look for whatever marker your application uses, for example `view.text.includes('requireAuth(')`.
- **A profile's `prepare` runs before every capture**, before the screen is opened. Keep the expensive part (signing in) out of it, as above.
- **Each profile runs in its own process**, with its own browser and cookie store, so one role's session cannot leak into another's pictures. The process and its browser are disposed on completion or timeout.

Use synthetic accounts from your seeder. Keep passwords in environment variables and list their names in `redactEnv`, which removes the values from any error text that reaches the report.

## Addresses with parameters

A route such as `/projects/[id]` has no picture until you say which project. There are three ways, from simplest to most flexible.

**A fixed example.** Use a record your seeder always creates with a known slug.

```ts
routes: {
  '/projects/[slug]': { path: '/projects/sample-project' },
}
```

**A resolver.** Look the record up when the capture runs. It receives `{ fixtures, models, profile }`, may be asynchronous, runs within the page's deadline, and must stay on the configured origin.

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

On a hand-written page, a resolver needs a `route` beside it (`route: '/orders/[id]'`), which is the pattern shown in the inventory. A derived page has it already. Reports keep only the final path, without query or fragment.

**A model fixture.** Name the model and supply its record. The model's primary key fills `[id]`; named fields fill parameters such as `[slug]` or `:slug`, URL-encoded.

```ts
fixtures: {
  Project: { id: 42, slug: 'sample-project' },
},
pages: screensFromViews({
  routes: { '/projects/[id]': { model: 'Project' } },
}),
```

Until one of these is in place the screen is listed as an explained gap:

```text
projects-id  /projects/[id]  [excluded: Needs a seeded example: give /projects/[id] a concrete path, fixture resolver or model.]
```

`--list` prints every gap, so it doubles as the to-do list for full coverage. Never invent an id: a made-up record shows an error page, and the capture then fails on the HTTP status or the readiness check.

### What the planner knows about your models

The command reads your `app/Models` definitions without running their factories, seeders or queries. `--list` reports each model's table and key, API resource, parent dependencies (including `useSeeder.after`), seeder count, factory and default coverage, required fields with no factory, sensitive fields and suggested UI states. Dependency cycles and parents outside the model set are named. These are setup hints for seeding a review environment, not proof that a screen exists or that a viewer is authorized.

- Framework default models are opt-in with `models: { includeDefaults: true }`. `models: false` disables inspection, which suits an application whose demo data comes from a seed script rather than model factories.
- An unambiguous `useApi.uri` can identify the model when a page omits `model`.
- Hidden, personal and encrypted fields, and token, password or secret parameters, cannot be bound into a published path. Fixture values are never copied wholesale into the manifest.
- Missing fixtures fail the capture of that screen.

A trusted `data.prepare(plan)` hook can return the fixture bindings after looking up existing synthetic records. It runs once per profile process, only during a capture; `data.cleanup()` runs afterwards. Neither runs for `--list` or `--check`.

The command never migrates, resets or seeds a database. Prepare a disposable environment with your seeder and the `@stacksjs/testing/database` factories, which keep the framework's relationship, password, validation and uniqueness rules, then point both the running server and the capture at it. If a hook creates records, its database connection and the application's must be the same disposable database.

## Redirects and error screens

**A redirect fails the capture.** A screen that lands on a different route, or on another origin, is recorded as failed, so a sign-in page can never stand in for the screen you asked for. A view that the router always redirects cannot be pictured at its own address; leave it out with the reason:

```ts
import { screensFromViews } from '@stacksjs/docs/screenshots'

const redirects: Record<string, string> = { '/dashboard': '/home' }

const pages = screensFromViews({
  each: view => redirects[view.route] ? `Redirects to ${redirects[view.route]}, which has its own picture.` : undefined,
})
```

**An HTTP error fails the capture** when the browser exposes the document's status. To require that proof, set `backend: 'chrome'` and `requireHttpStatus: true`: system WebKit does not expose the status, and strict verification then reports that limitation instead of passing. The manifest records the observed `httpStatus`, and `ready` hooks receive it.

**An intentional error screen** names its status: `expectedStatus: 404`. That requires an observable matching status. A page expected to return 200 fails on a 404 even when the error template contains the `waitFor` selector.

Selectors and `ready` hooks still have to verify the application's own state, including errors its JSON APIs return inside a 200 page.

## When a screen is loaded

A picture of a spinner documents nothing. For each screen the capture:

1. runs the profile's `prepare`, then opens the address;
2. checks the document's HTTP status;
3. runs the page's own `prepare`;
4. waits for the `waitFor` selector and for the `ready` hook to return `true`, polling every 100 milliseconds;
5. confirms the address did not change;
6. disables animations, transitions and carets, hides password inputs and configured `masks`, and waits for fonts and for the images in view;
7. saves the viewport.

A visible image that failed to load fails the capture. A screen that never settles within `timeoutMs` (30 seconds by default, per screen) is recorded as failed, with the step it stopped in.

A page often draws once before its data requests start, so a single look can pass too early. Put a `ready` hook in `defaults` that requires the quiet to last:

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

### More than one state of a screen

A view is captured once, as it first appears. For another state of the same address, add a page with its own id through `extra`. Its `prepare` hook runs after navigation and can open a tab, expand a section or scroll a control into view:

```ts
import { screensFromViews } from '@stacksjs/docs/screenshots'

const pages = screensFromViews({
  extra: [{
    id: 'settings-notifications',
    title: 'Notification preferences',
    path: '/settings',
    description: 'Choose which updates to receive.',
    sources: ['resources/views/settings.stx'],
    waitFor: '[data-notification-preferences]',
    async prepare({ view }) {
      await view.click('[data-open-notifications]')
      await view.scrollTo('[data-notification-preferences]')
    },
  }],
})
```

These are viewport pictures, not stitched full-page images: add named states for a long page. Images below the fold load when a hook scrolls them into view. Keep empty, error, loading and permission-denied states in the inventory when they matter to readers.

### What hooks may do

`prepare`, `ready` and path resolvers are trusted application code and can change data. Use fixtures, avoid real payment or deletion actions, and do not submit a consent on someone's behalf. A hook's error message is written to the report after `redactEnv` redaction.

## Viewports

The default viewports are `desktop` (1440 by 900) and `mobile` (390 by 844). `viewports` replaces them:

```ts
viewports: [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
],
```

A screen that exists at some sizes only names them with `viewports`. For example, an application that sends phones from `/home` to another address pictures `/home` on the desktop alone:

```ts
routes: {
  '/home': { viewports: ['desktop'] },
}
```

The other sizes are not captured, not expected by `--check`, and not counted as gaps.

Screen ids, profiles and viewport names form stable paths: `home/member-phone.png`. A phone-width browser capture verifies the web layout only. A native iOS or Android build needs its own simulator or device check.

## The walkthrough video

`film: true` joins the captured screens into one MP4 per viewport: `film-desktop.mp4`, `film-mobile.mp4`, or whatever your viewports are called. Screens appear in inventory order, each held for a moment.

```ts
film: {
  secondsPerScreen: 1.5, // default 2, from 0.2 to 30
  fps: 12,               // default 12, from 1 to 60
  viewports: ['desktop'], // default: every configured viewport
}
```

- The frame is the viewport's size, rounded up to even numbers as H.264 requires. A picture of another size is scaled to fit and padded with white.
- Only captured screens are filmed. Gaps and failures are skipped, so a failed screen never puts a stale picture in the video.
- The film is rebuilt from the whole manifest on every run, including a partial `--only` refresh, once the manifest has a result for every screen.
- There is no audio and no pointer.
- The video is H.264 in an MP4 container, which every current browser plays.

No FFmpeg is involved. The capture's browser encodes the frames through WebCodecs and [ts-videos](https://github.com/stacksjs/ts-videos), a TypeScript library, writes the MP4. If the browser cannot encode H.264, the pictures and the manifest are still written and the command then fails with the reason, so a missing encoder cannot pass unnoticed.

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

Publishing every capture is a choice. With synthetic accounts, masks on private fields and a seeded database, it is a safe one. If your review environment holds anything you would not publish, set `outDir` to a directory outside the docs, leave `docs` out, and copy the pictures you have reviewed into authored pages instead. `gallery.md` in the output directory lists every result with relative image links for that review.

## Commands

| Command | What it does |
| --- | --- |
| `./buddy docs:screenshots --list` | Validates the config and coverage and prints the inventory, the gaps and the model plan. No browser, no server. |
| `./buddy docs:screenshots` | Captures everything, then rebuilds the films, the docs page, `manifest.json` and `gallery.md`. |
| `./buddy docs:screenshots --only home,settings` | Captures the named screens and merges them into the saved manifest. |
| `./buddy docs:screenshots --viewport mobile` | Captures the named viewports only. Combines with `--only`. |
| `./buddy docs:screenshots --publish` | Rebuilds the films and the docs page from the saved manifest. No browser, no server. |
| `./buddy docs:screenshots --check` | Verifies that the saved output is complete and still matches the inventory. No browser, no server. |

`--config <path>` selects another config file, `--out <directory>` overrides `outDir`, and `--json` prints the full report. The command exits unsuccessfully when any capture failed.

### Partial captures

`--only` and `--viewport` merge into a previous manifest only when the config, the inputs and the `@stacksjs/docs` version are unchanged. After changing any of them, run a complete capture first. A first partial run into an empty directory stays incomplete, and `--check` fails until every screen, profile and viewport has been captured. It writes no films and leaves the docs page alone, since both describe the whole inventory, and `--publish` refuses such a manifest. That makes `--only … --out <scratch folder>` a safe way to try a few new screens.

A failed refresh keeps the previous picture's file so that a retry can replace it, but its failed status keeps that stale picture out of the films and the docs page.

### Deleted and renamed views

A complete run removes the pictures of screens that are no longer in the inventory, and their sections leave the docs page and the films. Only files the previous manifest recorded are removed; anything else in the output directory is left alone, and the command refuses to overwrite a picture or a manifest it did not write.

A renamed view is a deleted view plus a new one: the old pictures go and new ones appear under the new id. Authored pages that link to an old picture need updating by hand, which is a reason to link readers to the generated page rather than to individual files.

### Rebuilding without recapturing

`--publish` is for a change that only affects presentation, such as `film.secondsPerScreen` or the page title. Programmatic callers get the same split. A wrapper that captures in batches (one screen per call, to bound browser memory or to retry failures) would otherwise re-encode the films after every batch:

```ts
import { captureScreenshots, publishScreenshots } from '@stacksjs/docs/screenshots'

for (const id of ['home', 'settings', 'projects'])
  await captureScreenshots({ only: [id], publish: false })
await publishScreenshots()
```

Until `publishScreenshots()` runs, the manifest has no films or page, and `--check` fails with "The screen film is missing".

### Knowing when a recapture is due

`--check` fails when any of these changed since the last capture:

- the config file, or any file listed in `inputs`
- any view template named in a page's `sources`
- the `@stacksjs/docs` version, or an app model definition
- a picture, a film or the docs page on disk
- the inventory itself, for example a view was added and never captured

It cannot see a change that leaves all of those untouched, such as a component or a stylesheet that many views share, or a new deployment of a remote server. List shared files in `inputs` if you want them to trigger a recapture, include a build or source pin there when the running UI comes from another repository, or simply recapture on a schedule.

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
          git commit -m "docs: update screen captures"
          git push
```

Points that decide whether this works in practice:

- **Loops.** The commit changes files under `docs/`, which the `paths` filter does not watch, and a push made with the workflow's own token starts no further workflow. If you push with a personal token, or watch `docs/`, add `[skip ci]` to the commit message.
- **Failures still commit.** `if: always()` publishes the screens that did capture. The capture step has already failed the job, so a broken screen stays visible in CI and is listed under "Not pictured" in the docs.
- **Who commits.** `git config` in the job sets the author. Use an identity your branch protection accepts. To push to a protected branch, check out with a token that may do so.
- **Other CI systems.** The steps are plain shell. On a self-hosted runner, keep the same order and replace the setup steps with whatever provisions Bun, Chrome and your database there.
- **A gate instead of a bot.** To fail a pull request that changes a view without recapturing, run `./buddy docs:screenshots --check` in your checks instead of committing from CI.

### Repository size

Pictures are binary files, and every changed picture adds its full size to the repository's history. A few habits keep that small:

- Use `backend: 'chrome'`. Chrome renders one pixel per point. System WebKit on a Retina Mac renders two, which makes each PNG roughly three times larger.
- Capture from CI rather than from laptops, so the same machine produces every picture and unchanged screens produce identical bytes. Only changed files are committed.
- Give the demo data fixed dates and values where you can. A screen that prints "today" changes every day.
- Capture the viewports readers need. Two is the default; a third adds half again.
- Prefer a weekly schedule plus the path trigger over capturing on every push.

## Runtime requirements

The command needs a Bun with `Bun.WebView` and tells you to upgrade when it is missing.

| Platform | Default browser | Notes |
| --- | --- | --- |
| macOS | System WebKit, nothing to download | Set `backend: 'chrome'` to render as CI does |
| Linux, Windows | An installed Chrome-family browser | `BUN_CHROME_PATH` selects the executable |

Chrome captures and browser tests use the same Stacks launcher. Each capture profile starts a fresh owned browser with its own cookies and storage. The WebViews connect only to that browser’s loopback DevTools endpoint.

Bun's WebView API is experimental, and font rasterization and layout differ by engine and operating system. Keep the backend and the Bun version the same when comparing pictures. See [Bun's WebView documentation](https://bun.sh/docs/runtime/webview) for its current capabilities.

## Screens or stories?

| | `docs:screenshots` | [`docs:stories`](/testing/story-recordings) |
| --- | --- | --- |
| Covers | Every view, automatically | The journeys you script |
| Shows | Each screen at rest | Clicks, typing and transitions, with a visible pointer |
| Video | A slideshow per viewport | A real recording per journey |
| Viewports | Any number | One per story |
| Targets | The web application | The web application, iOS Simulator, Android Emulator |
| Maintenance | None for static views; one rule per parameterised address | One scene per step |
| Fails when | A screen errors, redirects or never loads | A step or assertion fails |

Use screens for breadth: nothing a user can open goes undocumented. Use stories for the handful of journeys worth watching end to end, such as signing up or paying. They share nothing but the application under test, so run both from the same CI job against the same seeded data and commit both outputs together.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Undocumented screens:` followed by template paths | A hand-written inventory misses those views. Add pages for them, exclude them with a reason under `coverage.exclude`, or derive the inventory with `screensFromViews()`. |
| `Screenshot rule for a view that does not exist: /x` | A key in `routes` matches no view. The view was renamed or deleted; update or remove the rule. Patterns use brackets: `/x/[id]`, not `/x/:id`. |
| `Dynamic view needs a concrete path or model` | `strict` is on and a parameterised address has no example. Add a `path` or `model` rule for it. |
| `The screen redirected to a different route` | The profile may not see the screen, or the router redirects it. Assign the right profile, or leave the view out with the redirect as its reason. If it redirects at one size only, limit the screen with `viewports`. |
| `The screen returned HTTP 404` | The example record does not exist in this database. Seed it, or resolve the id at capture time instead of hard-coding it. |
| `The browser did not expose a document HTTP status` | `requireHttpStatus` or `expectedStatus` is set and the backend is WebKit. Set `backend: 'chrome'`. |
| `The screen did not become ready before its deadline` | `waitFor` never matched or `ready` never returned `true`. Open the address in a browser as that role; raise `timeoutMs` only if the page is merely slow. |
| A picture shows skeletons or a spinner | The readiness check passed too early. Require a sustained quiet period, as in [When a screen is loaded](#when-a-screen-is-loaded). |
| Every screen is captured once per role | Pages have no `profiles`. Return one from `each`. |
| `Capture inputs or SDK changed` on `--only` | The config, an input or the package version changed since the saved manifest. Run a complete capture. |
| `The … screens could not be filmed: This browser cannot encode H.264 video` | The capture's browser has no H.264 encoder, which some Chromium builds leave out. Use Chrome (`backend: 'chrome'`, `BUN_CHROME_PATH`), or remove `film`. The pictures were still saved. |
| `The screen film is missing; capture again` | A capture ran with `publish: false`, or `film` was added after the last capture. Run `./buddy docs:screenshots --publish`. |
| `Refusing to replace a hand-written page` | `docs.page` points at a file the command did not generate. Choose another path or delete the file. |
| `Refusing to overwrite an unowned screenshot` | The output directory holds pictures from another tool under the same names. Use an empty `outDir`. |
| `--check` fails right after a capture in CI | A view, or a file listed in `inputs`, differs between the capture and the check, often a generated file that the build rewrites. Remove it from `inputs`. |
| Pictures differ between a laptop and CI | Different browser engines or pixel densities. Set `backend: 'chrome'` and treat CI's pictures as the published ones. |

## Reference

### Config

| Field | Default | Purpose |
| --- | --- | --- |
| `baseUrl` | Required | The running application's origin, without credentials, query or fragment |
| `outDir` | Required | Where pictures, films, `manifest.json` and `gallery.md` go |
| `pages` | Required | The inventory: `screensFromViews()`, hand-written pages, or both |
| `viewports` | Desktop and mobile | Named sizes, 200 to 7680 pixels per side |
| `profiles` | One `default` profile | Signed-in roles, each with an optional `prepare` |
| `backend` | WebKit on macOS, Chrome elsewhere | `'webkit'` or `'chrome'` |
| `requireHttpStatus` | `false` | Fail when the document's status cannot be observed |
| `timeoutMs` | `30000` | Deadline per screen, from 100 to 120000 |
| `coverage` | None | View directories that must be fully covered, with explained exclusions |
| `inputs` | None | Extra files whose changes require a recapture |
| `redactEnv` | None | Environment variable names whose values are removed from error text |
| `models` | App models | `{ includeDefaults: true }` adds framework models; `false` disables inspection |
| `fixtures` | None | Records that bind parameterised addresses, by model name |
| `data` | None | `prepare(plan)` and `cleanup()` hooks for fixtures looked up at capture time |
| `film` | Off | `true`, or `{ secondsPerScreen, fps, viewports }` |
| `docs` | Off | `{ page, base, title, description }` |

### Page

| Field | Purpose |
| --- | --- |
| `id` | Stable file name, unique in the inventory |
| `title`, `description`, `reason` | What the reader sees, and why the screen matters |
| `path` | A concrete address, a bracket pattern bound by `model`, or a resolver |
| `route` | The pattern shown in the inventory when `path` is a resolver |
| `model` | The model whose fixture fills the path's parameters |
| `sources` | Project-relative templates this screen covers |
| `profiles` | Who captures it. Default: every configured profile |
| `viewports` | The configured viewports it is captured at. Default: all |
| `waitFor` | Selector that must exist before the picture |
| `ready` | Hook that must return `true` before the picture |
| `prepare` | Hook that runs after navigation, to reach a state |
| `masks` | Selectors hidden in the picture, in addition to password inputs |
| `expectedStatus` | The HTTP status an intentional error screen must return |
| `skip` | A reason to leave the screen out while keeping it in the inventory |

### `screensFromViews(options?)`

Returns the pages for `pages`.

| Option | Default | Purpose |
| --- | --- | --- |
| `root` | Current directory | Project root |
| `directories` | `['resources/views']` | View directories, relative to the root |
| `defaults` | `{ waitFor: 'body' }` | `waitFor`, `profiles`, `viewports`, `masks`, `prepare`, `ready` and `reason` for every view |
| `each` | None | `(view) => rule`, computed per view |
| `routes` | None | Rules by exact route pattern |
| `extra` | None | Additional hand-written pages |
| `strict` | `false` | Fail on a parameterised address with no example |

`discoverViews({ root, directories })` returns the views themselves: `id`, `route`, `source`, `group`, `params`, `dynamic`, `title`, `layout` and `text`.

### Programmatic API

`@stacksjs/docs/screenshots` exports `defineScreenshotConfig`, `validateScreenshotConfig`, `captureScreenshots`, `publishScreenshots`, `screensFromViews` and `discoverViews`. `captureScreenshots` takes `config`, `root`, `outDir`, `only`, `viewports`, `list`, `check`, `publish` and an `onProgress` callback, and returns the report that is saved as `manifest.json`.
