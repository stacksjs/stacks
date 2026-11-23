---
title: Introducing Stacks
description: Stacks is a full-stack TypeScript framework for Bun, five years in the making. It is not out yet. Here is what it is, where it stands, why we wrote nearly every piece of it ourselves, and how to get in early.
date: 2026-06-12
author: The Stacks Team
authorBio: The team building Stacks, a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.
featured: true
---

Stacks is not released yet. We want to say that first, plainly, because the rest of this post is going to sound confident and we would rather you read it as a preview than as a launch.

For five years we have been building a TypeScript framework with one goal: shipping a whole product (the app, the API, the content, the docs and the cloud) should feel like using one tool instead of forty. Getting there meant building most of the ecosystem ourselves, and today almost every part of Stacks is something we wrote and maintain. The only runtime dependencies are TypeScript and Bun.

We are writing about it now because the pieces are close, and we would like you to come along for the last stretch. If you want to know the day it opens up, [join the launch list](#subscribe).

## What Stacks is

Stacks is a full-stack TypeScript framework. One codebase gives you routing, server-rendered views, an ORM, authentication, a CMS, queues, mail, storage, realtime, search, tests, documentation, a blog and cloud deployment. You scaffold with `buddy`, build your product, and ship every surface (marketing site, docs, blog, API, app server and infrastructure) with a single deploy.

If you have used Laravel, the shape will feel familiar: expressive routing, an Eloquent-style ORM with traits and relationships, factories and seeders, queues and jobs, a real CLI. That is deliberate. Laravel got the developer experience right. We wanted that same cohesion, native to TypeScript, running on Bun, with types flowing end to end and no context switching between a dozen unrelated packages.

> We are not trying to match the Laravel framework. We are trying to match the whole Laravel ecosystem: the framework, the first-party packages, the tooling, the deploy story and the docs platform.

## Where things stand

Here is the honest picture.

**What already works.** The framework runs real software today. This site is a Stacks app: the page you are reading was rendered by our own templating engine and deployed by our own cloud tooling. A handful of our own products run on it too, which is how most of the rough edges get found.

**What is left before we call it ready.**

- Settling the public APIs, so that upgrading never means rewriting.
- Documentation that covers every package, not just the framework.
- A first-run experience that works on the first try, on a fresh machine.
- Hardening the deploy path for setups that are not ours.

**When.** We are not putting a date on it. We would rather ship late than ship something you have to work around. The people on the launch list will hear first, and get access before the public release.

## Why we built almost everything ourselves

Most frameworks are a thin layer of glue over hundreds of transitive dependencies. That is fine until it is not: until a sub-dependency breaks, changes its license, ships a vulnerability or simply disagrees with how you want things to work. Every dependency is a decision someone else makes for you, on their schedule.

So we made a different bet: **own the stack**. If a piece is core to the developer experience, we build and maintain it ourselves. The only things we do not own are the language and the runtime, and we work with the grain of both.

It took most of the five years. It also means that when something in Stacks is slow or wrong, the fix is ours to make, and it lands in days instead of waiting on an upstream release.

## What we built instead of installing

Every one of these is a package we wrote. Most are useful on their own, outside Stacks entirely, and together they are Stacks.

### Developer tooling

- `pickier`, our linter and formatter. This is the one people do not believe at first: one fast tool in place of ESLint and Prettier.
- `dtsx`, a TypeScript declaration generator built for isolated declarations and speed.
- `stx`, the templating engine: server-rendered, component-driven views with signals and directives.
- `crosswind`, a utility-first CSS engine in the Tailwind tradition that we own top to bottom.
- `bunpress`, the documentation engine behind our docs.
- `buddy-bot` for dependency updates, plus `bumpx`, `gitlint` and `bun-git-hooks` for releases, commit linting and git hooks.

### Application building blocks

- `bun-router`, the HTTP router.
- `bun-query-builder`, the query layer under the ORM.
- `bun-queue` for jobs, batches and background work.
- `ts-collect` for Laravel-style collections, and `ts-validation` for schemas.
- `ts-auth` and `ts-security` for authentication, hashing and encryption.
- `ts-cache`, `ts-i18n`, `ts-datetime`, `ts-slug`, `ts-http` and `mail`.
- `ts-faker` for the fake data behind factories and seeders.

### Infrastructure and local development

- `ts-cloud`, infrastructure as TypeScript.
- `rpx`, `tlsx` and `dnsx` for pretty local domains, local TLS and DNS tooling.
- `localtunnels`, to share a local server publicly.
- `logsmith` and `clarity` for logging and diagnostics.
- `pantry` for system dependencies, and `very-happy-dom` as a DOM for tests.

### And the long tail

Image codecs (PNG, JPEG, WebP, AVIF, GIF), charts, maps, spreadsheets, QR codes, syntax highlighting, XML and dozens more libraries most projects pull in from third parties are first-party here. Add it up and it is well over a hundred packages.

## The road to 1.0

All of that has to become something you can depend on, not just something we can. So the work between now and release is to take each package to a stable, semver-backed `1.0`, with real docs, a test suite and a changelog behind the number. Plenty of them are already close.

We wrote up how we are approaching it, and what is on the map, in [The Road to v1.0s](/blog/the-road-to-v1).

## Get in early

This is the first of a series. Next up: why we wrote our own linter, what it takes to emit `.d.ts` files correctly, and how a whole product deploys with one command.

If you want to be there when Stacks opens up, [join the launch list](#subscribe). You get one email on launch day, an invite to try it before the public release, and an occasional note from the build. Nothing else, and you can leave in one click.

The source is already public on [GitHub](https://github.com/stacksjs/stacks) if you would rather watch it take shape.

Thanks for reading.

The Stacks team
