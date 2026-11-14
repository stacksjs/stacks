---
title: Automated screen documentation
description: Capture an explicit UI inventory with Bun WebView, verify template coverage and publish reviewed screenshots.
---

# Automated screen documentation

Use `buddy screenshot <url>` for a quick picture of one page. Use `buddy docs:screenshots` when documentation must cover a product's screens, roles and layouts repeatedly. It reads an explicit inventory, captures each selected screen on desktop and mobile, and writes PNGs, a JSON manifest and a Markdown gallery.

The inventory explains what each screen does. A picture supplements that explanation; it does not prove that a payment, consent, permission check or entire user journey works.

## Start with two screens

Run the application or point at a seeded review environment. Create `config/screenshots.ts`:

```ts
import { defineScreenshotConfig } from '@stacksjs/docs/screenshots'

export default defineScreenshotConfig({
  baseUrl: 'http://localhost:3000',
  outDir: 'storage/screenshots',
  coverage: { directories: ['resources/views'] },
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
    {
      id: 'settings',
      title: 'Account settings',
      path: '/settings',
      description: 'Review profile details and account preferences.',
      sources: ['resources/views/settings.stx'],
      waitFor: 'form[data-settings]',
      masks: ['[data-private-address]'],
    },
  ],
})
```

The selectors are examples: use selectors that your application actually renders once its data is ready. If the project has more templates, document them too or add an explicit exclusion. A dynamic route needs a concrete seeded example, such as `/projects/demo-project`, rather than `/projects/[id]`.

```sh
buddy docs:screenshots --list
buddy docs:screenshots
buddy docs:screenshots --check
```

`--list` validates the configuration and prints its inventory without opening a browser. Capture failures remain in `manifest.json` and make the command fail. `--check` validates full inventory coverage, source/configuration fingerprints and saved image hashes without contacting the application. It cannot tell whether a remote deployment has changed since capture; recapture after deploying a new build.

## Authentication and roles

Use synthetic, seeded accounts. Keep credentials in environment variables, outside the configuration and generated output. Each profile runs in a separate owned Bun process, because native Chrome WebViews otherwise share a cookie store. The worker and its browser descendants are disposed on completion or timeout.

A profile's `prepare` hook runs for every capture, before navigation to the target. This example uses an application's token login API; adapt the endpoint and storage convention to your application:

```ts
profiles: {
  reviewer: {
    async prepare({ view, baseUrl }) {
      const response = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: process.env.REVIEW_EMAIL,
          password: process.env.REVIEW_PASSWORD,
        }),
      })
      if (!response.ok) throw new Error('Review login failed')
      const session = await response.json() as { token: string }
      await view.navigate(`${baseUrl}/login`)
      await view.evaluate(`localStorage.setItem('token', ${JSON.stringify(session.token)})`)
    },
  },
},
redactEnv: ['REVIEW_EMAIL', 'REVIEW_PASSWORD'],
```

Set a page's `profiles: ['reviewer']` to restrict who captures it. Without that field, every configured profile captures the page. A redirect to another origin or route fails capture, so a login screen cannot silently stand in for the intended account page. Query strings and fragments are omitted from reports. Do not put secrets into screen ids, titles, descriptions or captions.

## Capture useful states

Use separate ids for meaningful states of the same route. A page's `prepare` hook runs after navigation and can open a tab, expand a section or scroll a control into view with the native WebView API:

```ts
{
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
  async ready({ view }) {
    return await view.evaluate(
      'document.querySelector("[data-notification-preferences]").dataset.loaded === "true"',
    )
  },
}
```

The tool waits for the page's selector, optional `ready` hook, fonts and visible image loads. It disables animations, transitions and carets before taking the picture. Password inputs and configured `masks` are hidden. A failed visible image prevents capture. Lazy images below the viewport load when a hook scrolls them into view.

These are viewport screenshots, not stitched full-page images or native simulator captures. Add several named states for a long page. Native iOS builds still need simulator/device checks; a 390px browser capture verifies the web layout only.

Hooks are trusted application code and can change data. Use fixtures, avoid real payment or deletion actions, and do not submit consent for another person. A hook's error is included in the report after configured environment-value redaction. Review every output before publishing.

## Prevent coverage gaps

`coverage.directories` scans `.stx` templates recursively. Every discovered template must be named by a page's `sources` or by an exact, explained exclusion:

```ts
coverage: {
  directories: ['resources/views'],
  exclude: {
    'resources/views/auth/reset.stx': 'Requires a one-use emailed token; the recovery guide explains this screen.',
  },
},
inputs: ['native/source-pin.json'],
```

Missing templates, empty coverage directories, stale exclusions, duplicate ids, unknown profiles and invalid viewports fail validation. Configuration, covered template and optional `inputs` bytes form the freshness fingerprint. Include a build/source pin when the running UI comes from another repository. Imported helper changes require listing that helper in `inputs` or recapturing with an updated build pin.

An exclusion explains a deliberate omission; it is not evidence that the omitted screen was visually verified. Keep error, empty, loading, mobile and permission-denied states in the inventory when they matter to readers.

## Output and CI

The default viewports are desktop (1440 by 900) and mobile (390 by 844). Configure `viewports` to replace them. Screen ids, profiles and viewport names form stable paths: `home/reviewer-mobile.png`.

```sh
buddy docs:screenshots --only home,settings --viewport mobile
buddy docs:screenshots --out docs/public/screens
```

A partial capture merges results with a matching previous manifest. A first partial run remains incomplete, and `--check` fails until all required combinations are captured. Existing unrelated files are never deleted. The JSON manifest identifies captures, explained exclusions and failures, with SHA-256 hashes. `gallery.md` contains the explanations and relative image links. Copy or link reviewed images from authored documentation rather than automatically publishing every capture.

In CI, start the application with seeded data, wait for readiness, run capture, then `--check`. Upload the manifest, gallery and PNGs as review artifacts even when capture fails. Only commit or publish the reviewed output. A capture does not replace behavioral tests or a person's visual review.

## Runtime requirements

The command feature-detects `Bun.WebView` and asks you to upgrade if unavailable. It uses the system WebKit on macOS, with no browser download. Linux and Windows use an installed Chrome-family browser; set `backend: 'chrome'` for consistent Chrome rendering on macOS too. `BUN_CHROME_PATH` selects its executable. Unattended workers force a fresh browser rather than connecting to a personal debugging session. Chrome workers in CI use `--no-sandbox` and `--disable-dev-shm-usage`.

Bun's WebView API is experimental. Font rasterization and layout can differ by backend and operating system. Keep the backend, Bun version and build pin consistent when comparing captures. See [Bun's WebView documentation](https://bun.sh/docs/runtime/webview) for its current capabilities.

## Use models and seeded records

The planner automatically reads your `app/Models` definitions without running their factories, seeders or queries. `--list` reports the model's table/key, API resource, declared parent dependencies (including `useSeeder.after`), seeder count, factory/default coverage, required fields missing factories, sensitive fields and suggested UI states. Framework default models are opt-in with `models: { includeDefaults: true }`; `models: false` disables inspection.

For example, a `Project` that belongs to `User` needs a synthetic user before a populated project can be captured. A required title with a factory is ready to seed; a required field with no factory/default needs an override. Dependency cycles and unavailable parent models stay explicit. These are setup hints, not proof that a screen exists or that a particular viewer is authorized.

Provide the concrete records from your seeded review environment:

```ts
fixtures: {
  Project: { id: 42, slug: 'sample-project' },
},
pages: [{
  id: 'project-detail',
  title: 'Project details',
  path: '/projects/[id]',
  model: 'Project',
  description: 'Inspect the seeded project and its assigned team.',
  sources: ['resources/views/projects/[id].stx'],
  waitFor: '[data-project-loaded]',
}],
```

The model's primary key supplies `[id]`; named fields such as `[slug]` or `:slug` use their fixture values, URL-encoded. An unambiguous `useApi.uri` can identify the model when `model` is omitted. Missing fixtures fail capture. Hidden/personal/encrypted fields and token/password/secret parameters cannot be bound into published paths. Fixture values are never copied wholesale into the manifest.

A trusted `data.prepare(plan)` hook can instead return those fixture bindings after looking up an existing synthetic record. It runs once per profile worker, only during capture; `data.cleanup()` runs afterward. Use the native seeder and `@stacksjs/testing/database` factories to prepare a disposable application environment, then point the running server and capture tool at that environment. Those factories preserve the framework's relationship, password, validation and uniqueness rules. Do not invent foreign keys or duplicate the factory implementation inside a screenshot script.

If a hook creates records, both its database connection and the running application must use the intended disposable database. The tool does not automatically run migrations, reset databases or seed a production target. List/check modes do not invoke data hooks. Include the source/build pin and relevant imported fixture helpers in `inputs`; model source changes are fingerprinted automatically. Capture empty, populated, validation-error and permission-denied states as separate inventory entries, with the seeded context each one requires.
