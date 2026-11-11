---
name: stacks-upstream
description: Use when a problem found in an app turns out to live in a dependency - a framework package, stx, ts-css, the router, the query builder, pantry, or any sibling library. Covers finding the owning repository from the package name, reproducing and fixing it there, releasing, and proving the fix from an installed version.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Fix it at the source

The rule: a defect in a dependency is fixed in the repository that owns it,
released, and consumed as a version. The app carries a version bump and nothing
else. Every dependency in this stack is homegrown, so the owner is always
reachable.

That rules in exactly one shape of change, and these are the shapes it replaces:
a vendored tarball, a patched copy under `node_modules`, a `file:` or `link:`
dependency that outlives the session, a shim in the app that corrects the
dependency's output. Each one fixes one app and leaves the next to find the
defect again.

## The loop

### 1. Name the owner

Read the `repository` field of the package that misbehaves, at the version the
app actually has installed:

```bash
bun -e "const p = require('./node_modules/<package>/package.json'); console.log(p.version, JSON.stringify(p.repository))"
```

The stack trace or the log prefix names the package: `[stx]` is `@stacksjs/stx`,
a frame under `node_modules/bun-query-builder` is that package. A monorepo's
`repository.directory` says which folder. The map at the end lists the owners
confirmed from those fields.

Done when you have a repository, a directory inside it and the installed version.

### 2. Check it is not already fixed

```bash
bun pm view <package> version
```

If the registry is ahead of the app, read that repository's changelog for the
symptom before writing anything. An upgrade may be the whole fix.

### 3. Reproduce it there, in isolation

In a checkout of the owning repository, on a branch, write the smallest failing
test that shows the defect with none of the app around it: the template, the
query, the config value, and the wrong result. Put it beside the package's
existing tests and copy their harness.

A reproduction that needs the app is not finished. Keep cutting until the
package's own test runner goes red on it. If it will not reproduce there, the
defect is in how the app or the framework calls the package: return to step 1
with the caller as the suspect.

Done when the new test is red, for the reason you saw in the app.

### 4. Fix and test in that repository

Fix the cause. Run that package's suite, and its lint and typecheck, with the
Bun version that repository pins. Commit in that repository's convention.

When the framework should have caught the problem (a config the scaffold wrote,
an option a harness passed), fix that in the framework too, with its own test.
The dependency fix makes the failure impossible or loud; the framework fix
stops it from being triggered.

Done when the reproduction is green and the suite is no worse than before.

### 5. Release

Use the owning repository's own release script (`bun run release:patch` in most
of these). A release is published work with the maintainer's name on it: do it
only when you have been asked to, otherwise stop here and hand over the branch
and the test.

### 6. Consume the version

A just-published version can be absent from Bun's cached manifest, and from the
registry's tarball store for a few minutes after the version is listed:

```bash
bun pm cache rm
bun pm view <package> version      # the new version is listed
bun add <package>@<version>        # or raise the range in package.json and install
```

An app pins the framework through the `stacks` package and `./buddy upgrade`;
read `stacks-dependencies` for where each range lives. One range per tool: do
not add a second declaration of something `better-dx` or `stacks` already ships.

### 7. Prove it from an installed version

A workspace link or `bun link` reads the package's source. The published
package is its `dist/` and whatever `files` allows, so a fix can pass every
linked test and be missing from what users install. Verify against the
registry's artifact:

- the version in `node_modules/<package>/package.json` is the released one, and
  the path is a real directory, not a symlink into a checkout;
- the original symptom is gone in the app, by the same observation that showed
  it (the log line, the rendered page, the failing command);
- for a change to build output, read the built file under
  `node_modules/<package>/dist/` and find the fix in it.

Done when the app's lockfile names the new version and the symptom is gone with
nothing local standing in for the release.

## While the fix is in flight

The app may need to keep moving before the release lands. Prefer writing the
app code in the form that is correct either way (compute a value in
`<script server>` instead of leaning on the broken expression). Where a
temporary workaround is unavoidable, mark it with the upstream branch or issue
and delete it in the commit that raises the version.

## Owners

Confirmed from the `repository` field of each installed package. Paths are in
that repository.

| Package | Repository |
|---|---|
| `stacks`, every `@stacksjs/<core package>` (`actions`, `auth`, `buddy`, `cli`, `config`, `database`, `defaults`, `orm`, `router`, `server`, ...) | `stacksjs/stacks`, `storage/framework/core/<name>` |
| `@stacksjs/stx`, `bun-plugin-stx`, `stx-router`, `@stacksjs/sanitizer`, `@stacksjs/desktop` | `stacksjs/stx` |
| `@stacksjs/components` | `stacksjs/stx`, `packages/components` |
| `@stacksjs/ts-css` | `stacksjs/ts-css`, `packages/toolkit` |
| `@cwcss/crosswind` | `cwcss/crosswind` |
| `@stacksjs/bun-router` | `stacksjs/bun-router` |
| `bun-query-builder` | `stacksjs/bun-query-builder` |
| `@stacksjs/bun-queue` | `stacksjs/bun-queue` |
| `@stacksjs/ts-validation` | `stacksjs/ts-validation` |
| `@stacksjs/ts-auth` | `stacksjs/ts-auth` |
| `@stacksjs/ts-cache` | `stacksjs/ts-cache` |
| `@stacksjs/ts-i18n` | `stacksjs/ts-i18n` |
| `@stacksjs/ts-cloud`, `@ts-cloud/*` | `stacksjs/ts-cloud` |
| `ts-broadcasting` | `stacksjs/ts-broadcasting`, `packages/ts-broadcasting` |
| `ts-collect` | `stacksjs/ts-collect` |
| `ts-error-handling` | `stacksjs/ts-error-handling` |
| `ts-rate-limiter` | `stacksjs/ts-rate-limiter` |
| `@stacksjs/httx` | `stacksjs/ts-http` |
| `@stacksjs/ts-faker` | `stacksjs/ts-mocker` |
| `@stacksjs/ts-md`, `@stacksjs/ts-xml`, `ts-slug`, `ts-spreadsheets`, `ts-qr-codes`, `ts-syntax-highlighter`, `ts-medium-editor`, `ts-video-player` | `stacksjs/<the same name without the scope>` |
| `ts-images`, `ts-jpeg`, `ts-gif`, `@stacksjs/ts-png`, `@stacksjs/ts-webp`, `@stacksjs/ts-avif`, `@stacksjs/ts-heic`, `@stacksjs/ts-bmp`, `@stacksjs/ts-svg` | `stacksjs/<the same name without the scope>` |
| `@ts-audio/*` | `stacksjs/ts-audio` |
| `ts-videos`, `@ts-videos/*` | `stacksjs/ts-videos` |
| `@ts-charts/*` | `stacksjs/ts-charts`, `packages/<name>` |
| `@stacksjs/clapp` | `stacksjs/clapp` |
| `bunfig` | `stacksjs/bunfig` |
| `@stacksjs/gitit` | `stacksjs/gitit` |
| `@stacksjs/gitlint` | `stacksjs/gitlint` |
| `bun-git-hooks` | `stacksjs/bun-git-hooks` |
| `@stacksjs/bumpx` | `stacksjs/bumpx` |
| `@stacksjs/logsmith` | `stacksjs/logsmith` |
| `@stacksjs/clarity` | `stacksjs/clarity` |
| `@stacksjs/rpx` | `stacksjs/rpx` |
| `@stacksjs/tlsx` | `stacksjs/tlsx` |
| `@stacksjs/dnsx` | `stacksjs/dnsx` |
| `localtunnels` | `stacksjs/localtunnels`, `packages/localtunnels` |
| `@stacksjs/bunpress` | `stacksjs/bunpress`, `packages/bunpress` |
| `bun-plugin-dtsx`, `@dtsx/*` | `stacksjs/dtsx` |
| `bun-plugin-auto-imports` | `stacksjs/bun-plugin-auto-imports` |
| `dynamodb-tooling` | `stacksjs/dynamodb-tooling` |
| `very-happy-dom` | `stacksjs/very-happy-dom` |
| `better-dx` | `stacksjs/better-dx` |
| `@buddysh/buddy` (buddy-bot) | `stacksjs/buddy` |
| `pickier` | `pickier/pickier` |
| `ts-pantry` | `pantry-pm/pantry`, `packages/ts-pantry` |
| `craft-native` | `craft-native/craft`, `packages/typescript` |

A package missing from the table is read the same way as step 1. Add it here
once confirmed.

## Gotchas

- **The framework has two install trees in an app that uses Pantry.** Check the
  version in the tree the failing process resolves from before concluding a
  bump did nothing.
- **A dependency that bundles another needs its own release.** A fix in a
  library that a second package inlines at build time reaches users only when
  that second package is rebuilt and released too.
- **Renamed or scoped spellings.** `@stacksjs/httx` lives in `ts-http` and
  `@stacksjs/ts-faker` in `ts-mocker`. Trust the `repository` field over the name.
