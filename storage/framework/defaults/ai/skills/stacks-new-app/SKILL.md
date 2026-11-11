---
name: stacks-new-app
description: Use when starting a Stacks app with buddy new or structuring one in its first days - choosing feature bundles, picking free dev ports, laying out layouts, partials, components and page data, setting theme tokens, placing plan limits, or running the first verification loop. Covers buddy new, the starter under resources/, config/ui.ts and config/css.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# From buddy new to a structured app

The path from an empty directory to an app with a shape worth building on. Each
step ends on something you can observe. Subsystem detail lives in the skill each
step names.

## 1. Scaffold

```bash
buddy new my-app            # dashboard, marketing, monitoring, queue, realtime on
buddy new my-app --minimal  # none of them; add back with ./buddy <feature>:install
```

`buddy new --help` lists the flags, and every one of them does something.
`./buddy list` shows the `<feature>:install` commands. Commerce, cms and forms
are off in every new app until you install them; `--minimal` turns the rest
off too. Start `--minimal` when the app needs no admin dashboard or queue yet:
a bundle brings models, migrations and dashboard pages you would otherwise
carry and seed for nothing.

A feature that is off has no tables. That is by design: `./buddy migrate` skips
its migrations and says so (`Skipping N migration(s) for disabled features`).

What you get: the framework from npm (no `storage/framework/core`), a
gitignored `storage/framework/defaults` link, `.env` with a generated `APP_KEY`,
SQLite as the database (`DB_CONNECTION=sqlite`, the file is `database/stacks.sqlite`),
app-shaped CI in `.github/`, an `AGENTS.md`, and one commit holding all of it.

What you do not get: a domain, a design, a `CONTEXT.md`, `docs/`, a blog, or any
analytics, mail server, DNS or cloud target. `config/analytics.ts`,
`config/cloud.ts`, `config/dns.ts`, `config/email.ts` and `config/team.ts` start
empty on purpose, so nothing reaches an outside service until you fill them in.

Done when `git log --oneline` shows the scaffold commit and `git status` is clean.

## 2. Pick ports, then boot

Another project may already hold 3000. Check before the first boot, because a
taken port is reassigned with one warning line that is easy to miss:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Set the three in `.env` (`config/ports.ts` reads them), in a block no other app
on the machine uses:

```
PORT=3270
PORT_API=3278
PORT_BACKEND=3271
```

Then `./buddy dev`. Done when the boot prints your ports, no `[stx]` warning
line, and the Site URL renders the starter page. `stacks-development` covers
the dev server, the reverse proxy and `./buddy setup:ssl` for a pretty URL.

## 3. Read the starter before replacing it

Four files, one of each kind, wired together:

| File | Role |
|---|---|
| `resources/views/layouts/default.stx` | The document shell: `<head>`, skip link, `<main>`, the `content` section |
| `resources/partials/head.stx` | The shared `<head>`. Title and canonical URL come from `config/app.ts` |
| `resources/components/NextStep.stx` | A component, used by tag name, reading `$props` |
| `resources/views/index.stx` | A page: extends `default`, fills `content` |

A page names itself by declaring `pageTitle`, `pageDescription` or
`canonicalPath` in its `<script server>`; the head partial reads them and falls
back to the site. Keep that contract when you restyle. `config/ui.ts` pins the
three folders stx scans. Layouts live in `resources/views/layouts`, the one
folder scanned.

## 4. Give the app its structure

- **Layouts.** One per document shape (marketing, app, auth), not one per page.
  Navigation and footer are components the layout places.
- **Partials** for fragments a layout includes (`head`). **Components** for
  anything a page places by tag. Group components in one subfolder per area
  (`Marketing/SiteNav.stx`); the tag stays `<SiteNav />`.
- **Page content in `resources/data/*.ts`.** Navigation items, feature lists,
  pricing rows and site identity each live in one typed module that pages and
  components import with `~/resources/data/<name>`. A string that appears on
  two pages is defined once. Restart `./buddy dev` after editing a data module:
  a view reloads, a module it imported is cached for the life of the process.
- **Theme tokens as CSS custom properties.** Define each color once in a
  stylesheet under `public/assets/styles/`, with the dark value under
  `prefers-color-scheme` (or the `dark` class), then expose it in `config/css.ts`:

  ```ts
  theme: { extend: { colors: { surface: 'var(--surface)', ink: 'var(--ink)', accent: 'var(--accent)' } } }
  ```

  `bg-surface text-ink` then follows light and dark with one class and no
  `dark:` twin. Read `stacks-ts-css` for the engine and `stacks-design-taste`
  before choosing the values.
- **Plan limits in one file.** When the app has plans, put every limit (seats,
  storage, sends per month) in one module, for example `app/Billing/limits.ts`,
  keyed by plan. The pricing page, the upgrade prompt and the action that
  enforces the limit all import it, so a displayed limit and an enforced limit
  cannot disagree. Amounts are integer minor units. `stacks-payments` covers
  the plans themselves.

Done when each of layouts, partials, components and data has one real file and
no page carries a literal the data modules own.

## 5. Name the domain before the first model

Write `CONTEXT.md` with `stacks-domain-modeling`: the nouns, what each means
here, and the words you rejected. Model names, table names and route names come
from it, and a rename after the first migration costs a migration. Then build
the first slice with `stacks-new-feature`.

An app that serves several tenants by hostname decides that now: read
`stacks-sites` before the first tenant-owned model, because the owner column and
the query scoping belong in that model's first migration.

## 6. Verify, every time

```bash
./buddy lint
./buddy typecheck
./buddy test
```

Run tests with the Bun the project pins (`./buddy test`, or `./pantry/.bin/bun
test` where Pantry installed it); a different Bun on PATH invents failures. Then
load the changed page in a real browser with `stacks-browse`: a 200 with an
empty component or an unstyled page passes all three commands.

Done when all three are clean and the browser shows what you changed, in light
and dark.

## 7. Ship

`stacks-deploy` owns the deploy and `stacks-cloud` the target. Before the first
one: `APP_URL` is the real host, `config/cloud.ts` names where it runs, the DNS
record for every hostname the app answers exists (`./buddy dns <domain>` shows
what resolves), and `ANALYTICSHQ_SITE_ID` is set if you want analytics.

## Gotchas

- **A view has exactly one layout.** An `@if` around two `@extends` lines does
  not choose between them. Extend one layout and let it branch on a variable
  the page declares.
- **A public route never resolves the signed-in user.** No auth middleware runs
  on it, so `request.user()` is empty there even with a valid session. A page
  that shows signed-in state asks an endpoint of its own that carries the auth
  middleware. `stacks-auth` and `stacks-middleware` cover both sides.
- **`hidden` loses to a display utility.** `<div hidden class="flex">` stays
  visible, because `flex` sets `display` and the attribute's rule is weaker. Put
  `[hidden] { display: none !important; }` in the app stylesheet once.
- **Your own `app/Models` turns the built-in models off.** Once the app has a
  model of its own, migrations are generated from `app/Models` alone. Set
  `database.models.includeFrameworkDefaults` in `config/database.ts` to keep
  generating the built-in ones the app still uses (`User`, `Team`, ...).
- **Run `./buddy generate:db-types` after migrating.** It refreshes
  `database/types.d.ts`; without it rows from `db.selectFrom` on a new table
  come back untyped.

- **A new view answers 404 until the dev server restarts.** Routes are generated
  at boot.
- **Stay off dynamic bracket access in templates** and keep directive names out
  of layout comments. Both fail quietly; `stacks-stx` has the exact shapes.
- **A problem in the framework or one of its packages is fixed there.** Read
  `stacks-upstream` instead of working around it in the app.
