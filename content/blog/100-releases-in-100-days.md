---
title: 100 Releases in 100 Days
description: After five years of building in private, we are committing to a sustained public cadence — 100 releases over the next 100 days, with packages stepping out of the monorepo as tools you can adopt one at a time.
date: 2026-06-12
author: The Stacks Team
authorBio: The team building Stacks — a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.
poster: /assets/images/marketing-park-geyser.svg
featured: false
---

In [our last post](/blog/introducing-stacks) we said the quiet part out loud: after five years of building, the only runtime dependencies Stacks ships are TypeScript and Bun, and almost every other piece — the linter, the formatter, the type generator, the templating engine, the CSS engine, the query builder — is something we wrote and maintain ourselves. Now comes the harder part: shipping all of it, in the open, on a schedule. We're calling it **100 Releases in 100 Days**.

## What the campaign is

Starting now, we're committing to a sustained public cadence: **100 releases over the next 100 days**. New versions, new documentation, and — most importantly — packages stepping out of the monorepo and into the open as tools you can adopt one at a time, even if you never use the rest of Stacks.

A "release" here is deliberately broad, because the work is broad:

- A new or graduated package published to the registry with real docs.
- A meaningful version bump — features, fixes, performance — on something we already ship.
- A documentation site or guide going live for a package that didn't have one.

What it is *not* is 100 empty version bumps. The point isn't the number; the number is the forcing function. After years of building in private, the discipline we need now is to ship loudly, consistently, and in public — and to let people use the pieces.

## Why now

For most of its life, Stacks has been a single large effort: prove that one team can own a full-stack framework end to end without renting its foundations from a hundred upstream maintainers. That bet is settled internally — it runs in production. The remaining gap is purely one of *availability*: the pieces exist, but they've been easier to find by reading our source than by running `bun add`.

> The goal of the next 100 days is to close the distance between "we built it" and "you can use it."

## What's actually shipping

The catalog spans the whole stack. Over the campaign you'll see releases land across:

- **Developer tooling** — `pickier` (our linter + formatter), `dtsx` (the `.d.ts` generator), `bunpress` (docs), `stx` (templating), `crosswind` (the CSS engine), `buddy-bot`, `bumpx`, `gitlint`.
- **Application building blocks** — the router, the query builder and ORM, the queue, collections, validation, auth, cache, i18n, dates, mail, and the HTTP client.
- **Infrastructure & local dev** — `ts-cloud`, `rpx`, `tlsx`, `dnsx`, `localtunnels`, and the logging tools.
- **The long tail** — image codecs, charts, maps, spreadsheets, QR codes, and the dozens of smaller libraries most projects pull from third parties.

Each one is independently useful. You can take `pickier` without adopting the framework, or `dtsx` on its own, or the query builder by itself. That's the whole idea of owning the stack: the pieces are coherent together, but they aren't a cage.

## How to follow along

We'll post here as notable releases land — a running shipping log alongside the deeper "why we built this" write-ups. The first deep dives are already queued: why we wrote our own linter and formatter, what it takes to emit `.d.ts` files correctly, and how the deploy path collapses into a single command.

If you want the short version in your inbox, subscribe from the homepage. Otherwise: the docs are at [/docs](/docs), the source is on [GitHub](https://github.com/stacksjs/stacks), and the trail map is [the launch post](/blog/introducing-stacks).

100 days. We're counting from today.

— The Stacks team
