---
title: The Road to v1.0s
description: After five years of building in private, the work now is to ship in public - and to take every package in the Stacks catalog all the way to a stable, semver-backed 1.0. This is the map of that climb.
date: 2026-06-12
author: The Stacks Team
authorBio: The team building Stacks - a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.
poster: /assets/images/marketing-park-summit.svg
featured: false
---

In [our launch post](/blog/introducing-stacks) we said the quiet part out loud: after five years of building, the only runtime dependencies Stacks ships are TypeScript and Bun, and almost every other piece - the linter, the formatter, the type generator, the templating engine, the CSS engine, the query builder - is something we wrote and maintain ourselves. Building it was the hard part. The next part is harder in a different way: taking the whole catalog into the open, on a schedule, and all the way to a number we can stand behind. We're calling it **The Road to v1.0s** - plural, because there isn't one summit. There are more than a hundred.

## What "1.0" means to us

A version number is a promise. `0.x` says *"this works, but we reserve the right to move things."* `1.0` says *"build on this - we won't pull the floor out from under you."* For years our packages have quietly earned the second statement while still carrying the first one's number. The road to v1.0 is about closing that gap honestly.

So we wrote down what a Stacks package has to clear before it gets the number. Every `1.0` means **all** of the following:

- **A stable public API** under [semantic versioning](https://semver.org). After 1.0, breaking changes mean a major bump - never a quiet patch.
- **Real documentation** - installation, a guided start, and a full API reference - not a README stub.
- **A test suite** that runs on every commit, with the package's core paths actually covered.
- **A published changelog**, so upgrading is a decision you make with information, not a surprise.
- **Independent usability** - it installs and works on its own, with no hidden dependency on the rest of Stacks.

That last point is the one we care about most. None of these packages are hostages to the framework.

> The goal of the road isn't a version number. It's to close the distance between *"we built it"* and *"you can depend on it."*

## Why a road, not a launch

We could have tagged a hundred `1.0`s in an afternoon and called it a launch. We didn't, because a launch is an event and trust is a habit. A package earns 1.0 by being used, documented, and held still long enough that people stop checking whether it'll move.

So instead of one big-bang release, we're doing this as a sustained public cadence - packages stepping out of the monorepo and onto the registry one at a time, each with the docs and the tests and the changelog that make the number mean something. You'll be able to watch the catalog climb. A "release" along the way is deliberately broad, because the work is:

- A package **graduating** to a stable `1.0` with its full docs and test suite.
- A meaningful **version bump** - features, fixes, performance - on something already shipping.
- A **docs site or guide** going live for a package that didn't have one.

What it is *not* is a hundred empty version bumps. The number is the forcing function, not the point.

## What's on the map

The catalog spans the whole stack, and different parts of it are at different altitudes. Here's roughly where things stand on the climb.

### Near the summit - stable and in daily use

These run in production today and are closest to earning the number:

- `pickier` - our linter and formatter, replacing ESLint and Prettier with one fast tool.
- `dtsx` - the `.d.ts` generator, built for isolated declarations and speed.
- `bunpress` - the documentation engine. This very page is rendered by it.
- `stx` - the templating engine: server-rendered, component-driven views with signals and directives.
- `crosswind` - the CSS engine, a utility-first system in the Tailwind tradition.

### Climbing - solid, finishing docs and edges

The application building blocks - battle-tested inside the framework, getting their standalone docs and final API polish before they graduate:

- `bun-router` - the HTTP router.
- `bun-query-builder` and `ts-query-builder` - the query layer under the ORM.
- `bun-queue` - jobs, batches, and background work.
- `ts-collect` - Laravel-style collections.
- `ts-validation`, `ts-auth`, and `ts-security` - validation, authentication, hashing, and encryption.
- `ts-cache`, `ts-i18n`, `ts-datetime`, `ts-slug`, `ts-http`, and `mail` - caching, localization, a Carbon-like date library, slugs, an HTTP client, and mail.

### Base camp - infrastructure, local dev, and the long tail

The deploy story, the local-dev tooling, and the dozens of smaller libraries most projects pull from third parties:

- `ts-cloud` - infrastructure-as-TypeScript for AWS deploys.
- `rpx`, `tlsx`, `dnsx`, and `localtunnels` - pretty local domains, local TLS, DNS tooling, and public tunnels.
- `logsmith` and `clarity` - logging and diagnostics.
- `buddy-bot`, `bumpx`, `gitlint`, and `bun-git-hooks` - dependency updates, version bumping, commit linting, and git hooks.
- The long tail - image codecs (PNG, JPEG, WebP, AVIF, GIF, BMP), charts, maps, spreadsheets, QR codes, countries, numbers, VAT, syntax highlighting, web scraping, and XML.

Each one is independently useful. You can take `pickier` without adopting the framework, or `dtsx` on its own, or the query builder by itself. That's the whole idea of owning the stack: the pieces are coherent together, but they aren't a cage.

## How to follow the climb

We'll post here as packages reach the summit - a running shipping log alongside the deeper "why we built this" write-ups. The first deep dives are already queued: why we wrote our own linter and formatter, what it takes to emit `.d.ts` files correctly, and how the deploy path collapses into a single command.

If you want the short version in your inbox, subscribe from the homepage. Otherwise: the docs are at [/docs](/docs), the source is on [GitHub](https://github.com/stacksjs/stacks), and the trailhead is [the launch post](/blog/introducing-stacks).

The summit register is open. We're counting up from here.

---

- The Stacks team
