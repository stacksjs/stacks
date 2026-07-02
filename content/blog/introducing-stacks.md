---
title: Introducing Stacks
description: Five years ago we started building a TypeScript framework. Today almost every part of Stacks - the linter, the formatter, the type generator, the templating engine, the CSS engine, the query builder - is something we wrote ourselves. The only dependencies we ship are TypeScript and Bun.
date: 2026-06-12
author: The Stacks Team
authorBio: The team building Stacks - a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.
poster: /assets/images/marketing-park-trail.svg
featured: true
---

Five years ago, we started building a TypeScript framework. The goal sounded simple: make shipping a full product - app, API, content, docs, and cloud - feel like one tool instead of forty. The reality was harder. To get there, we had to stop borrowing the ecosystem and start building it. Today, almost every part of Stacks is something we wrote ourselves, and the only runtime dependencies we ship are TypeScript and Bun.

This is the story of how we got here - and what we mean by [The Road to v1.0s](/blog/the-road-to-v1).

## What Stacks is

Stacks is a full-stack TypeScript framework. One codebase gives you routing, server-rendered views, an ORM, authentication, a CMS, queues, mail, storage, realtime, search, tests, documentation, a blog, and cloud deployment. You scaffold with `buddy`, you build your product, and you ship every surface - marketing site, docs, blog, API, app server, and AWS infrastructure - with a single deploy.

If you've used Laravel, the shape will feel familiar: expressive routing, an Eloquent-style ORM with traits and relationships, factories and seeders, queues and jobs, a real CLI. That's deliberate. Laravel got the developer experience right. What we wanted was that same cohesion - but native to TypeScript, running on Bun, with types flowing end to end and no context-switching between a dozen unrelated packages.

> We're not competing with the Laravel *framework*. We're competing with the whole Laravel *ecosystem* - the framework, the first-party packages, the tooling, the deploy story, the docs platform, all of it.

## The dependency philosophy

Here's the part that took five years.

Most frameworks are a thin layer of glue over hundreds of transitive dependencies. That's fine until it isn't - until a sub-dependency breaks, changes its license, ships a vulnerability, or simply disagrees with how you want things to work. Every dependency is a decision someone else gets to make for you, on their schedule.

So we made a different bet: **own the stack**. If a piece is core to the developer experience, we build and maintain it ourselves. The only things we don't own are the language (TypeScript) and the runtime (Bun) - and we work closely with the grain of both.

That's not a slogan. It's a long list of real, shipping, independently-usable packages.

## What we built instead of installing

Every one of these is a package we created and maintain. Most are useful on their own, outside Stacks entirely - but together they *are* Stacks.

### Developer tooling

- `pickier` - our linter and formatter. This is the one people don't believe at first: we replaced ESLint and Prettier with a single fast tool.
- `dtsx` - our TypeScript declaration (`.d.ts`) generator, built for isolated declarations and speed.
- `bunpress` - our documentation engine, the way we build docs sites (our answer to VitePress). This very page is rendered by it.
- `stx` - our templating engine: server-rendered, component-driven views with signals and directives.
- `crosswind` - our CSS engine, a utility-first system in the Tailwind tradition that we own top to bottom.
- `buddy-bot` - our dependency update bot (instead of Renovate or Dependabot).
- `bumpx`, `gitlint`, and `bun-git-hooks` - version bumping, commit linting, and git hooks.

### Application building blocks

- `bun-router` - the HTTP router.
- `bun-query-builder` and `ts-query-builder` - the query layer under our ORM.
- `bun-queue` - jobs, batches, and background work.
- `ts-collect` - Laravel-style collections.
- `ts-validation` - schema validation.
- `ts-auth` and `ts-security` - authentication, hashing, and encryption.
- `ts-cache`, `ts-i18n`, `ts-datetime`, `ts-slug`, `ts-http`, and `mail` - caching, localization, a Carbon-like date library, slugs, an HTTP client, and mail.
- `ts-faker` - fake data for factories and seeders.

### Infrastructure & local dev

- `ts-cloud` - infrastructure-as-TypeScript for AWS deploys.
- `rpx` - a reverse proxy for pretty local domains.
- `tlsx` - local TLS certificates.
- `dnsx` - DNS tooling.
- `localtunnels` - share your local server publicly (our take on ngrok).
- `logsmith` and `clarity` - logging and diagnostics.
- `pantry` - system dependency management.
- `very-happy-dom` - a DOM implementation for tests.

### And the long tail

Image codecs (PNG, JPEG, WebP, AVIF, GIF, BMP), charts, maps, spreadsheets, QR codes, countries, numbers, VAT, syntax highlighting, web scraping, XML - dozens more libraries that most projects reach for as third-party dependencies, all first-party here. We're even exploring native implementations in Zig for the hottest paths.

Add it up and it's well over a hundred packages. Which brings us to what comes next.

## The Road to v1.0s

We've been heads-down for a long time. The pieces are real, they're in production, and they're ready to come out into the open - properly versioned, documented, and supported.

So starting now, we're walking [**The Road to v1.0s**](/blog/the-road-to-v1): a sustained, public push to take every package in the catalog to a stable, semver-backed `1.0`. New versions, new docs, new packages stepping out of the monorepo and into the open as tools you can adopt one at a time - even if you never use the rest of Stacks. A linter here, a query builder there, a docs engine, a CSS engine. Take the pieces you want. [Read the full map →](/blog/the-road-to-v1)

It's more than a hundred summits. That's the point. After five years of building quietly, the work now is to ship loudly and consistently - and to put a number behind it that you can build on.

## What's next

This is the first post on the Stacks blog, and the first of a series. Over the coming weeks we'll go deep on the decisions behind the framework - why we built our own linter, what it takes to write a `.d.ts` emitter, how the deploy path collapses into a single command, and what "owning the stack" actually costs and pays back.

If you want to follow along, the docs are at [/docs](/docs), the source is on [GitHub](https://github.com/stacksjs/stacks), and you can subscribe for field notes from the homepage. The trail is just getting started.

---

- The Stacks team
