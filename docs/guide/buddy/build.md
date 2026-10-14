---
title: Build Command
description: "The  command compiles your Stacks application and libraries for production use, optimizing assets for deployment to npm, CDNs, or cloud providers."
---
# Build Command

The `buddy build` command compiles your Stacks application and libraries for production use, optimizing assets for deployment to npm, CDNs, or cloud providers.

## Basic Usage

```bash
# Interactive build - select what to build
buddy build

# Build specific target
buddy build components
```

## Command Syntax

```bash
buddy build [type] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `type` | Optional. Specify build target (components, web-components, functions, views, docs, buddy, cli, stacks, server) |

### Options

| Option | Description |
|--------|-------------|
| `-c, --components` | Build your component library |
| `-w, --web-components` | Build your framework-agnostic web component library |
| `-e, --elements` | Alias for --web-components |
| `-f, --functions` | Build your function library |
| `-p, --views` | Build your frontend views |
| `--pages` | Alias for --views |
| `-d, --docs` | Build your documentation site |
| `-b, --buddy` | Build the Buddy binary |
| `-s, --stacks` | Build Stacks framework |
| `--server` | Build the Stacks cloud server (Docker image) |
| `--project [project]` | Target a specific project |
| `--verbose` | Enable verbose output |

## Build Targets

### Components Library

Build both STX and Web Component libraries:

```bash
buddy build:components
# or
buddy prod:components
```

This creates production-ready component libraries for distribution via npm or CDN.

### Web Components

Build framework-agnostic Web Components (Custom Elements):

```bash
buddy build:web-components
# or
buddy build:wc
buddy prod:web-components
buddy prod:wc
```

### Functions Library

Build your function library for npm distribution:

```bash
buddy build:functions
```

### Frontend Views

Build your frontend for static site generation (SSG):

```bash
buddy build:views
```

### Documentation

Build your documentation site:

```bash
buddy build:docs
# or
buddy build:documentation
buddy prod:docs
buddy prod:documentation
```

### CLI

Build the Buddy CLI binary:

```bash
buddy build:cli
# or
buddy prod:cli
```

### Desktop Application

Build the desktop application with the Craft runtime and compiled Stacks launcher:

```bash
buddy build:desktop
# or
buddy prod:desktop
```

### Mobile Applications

Build both native projects, or target one platform while iterating:

```bash
buddy build:mobile
buddy build:ios
buddy build:android
# aliases
buddy prod:mobile
buddy prod:ios
buddy prod:android
```

#### The iOS toolchain

`buddy build:ios` generates the Xcode project with
[xcodegen](https://github.com/yonaskolb/XcodeGen), and it runs the copy Pantry
installed, at the version `config/deps.ts` pins, never whichever one is first
on `PATH`. Two machines building one commit then generate the same project.
Declare the tools beside `androidDependencies`:

```ts
// config/deps.ts
export const iosDependencies = {
  'github.com/yonaskolb/XcodeGen': '2.46.0',
}
```

Without the export the framework default (`^2.46.0`) applies. Install them
once per machine:

```bash
buddy setup:ios   # pantry install --user github.com/yonaskolb/XcodeGen@2.46.0, then checks for Xcode
```

A build on a machine without them stops before doing anything, naming the
command that installs them. The build looks in the project's `pantry/`, the
user install (`~/.local/share/pantry/global/packages`, or under
`XDG_DATA_HOME`) and `/usr/local/packages`.

Xcode itself does not come from Pantry: Apple ships it only through the Mac
App Store and developer.apple.com. Install it there and select it with
`sudo xcode-select --switch /Applications/Xcode.app`. Generating the project
needs only xcodegen; building, archiving and running a simulator need Xcode.

#### Native screens

The screens a cold start shows can be drawn natively (UIKit) instead of in the
web view. They are ordinary `.stx` files in `resources/native`, compiled by
stx's native compiler (`@stacksjs/stx/native`) during `buddy build:ios`; every
other path, and every tap out of a native screen
(`craft.navigation.open('/path')`), stays in the web view.

```ts
// config/mobile.ts
ios: {
  nativeScreens: { '/m': 'Today' }, // resources/native/Today.stx
  // The native tab bar's first frame, before the page describes its own.
  tabs: [{ id: '/m', title: 'Today', symbol: 'sun.max' }, { id: '/m/calendar', title: 'Calendar', symbol: 'calendar' }],
  // The page's sign-in, for the native screen's own API requests.
  shareStorage: { auth_token: 'auth.token' },
}
```

A native screen reads what the page last saved before its first frame
(`craft.snapshots.get(name)`, written by the page with `snapshots.set` from
`@stacksjs/mobile`) and the sign-in with `craft.secureStorage.getSync(key)`.

### Shipping the iOS App to TestFlight

`buddy release:ios` turns the current main into a TestFlight build. It
regenerates the iOS project for production (dropping any `MOBILE_URL` a dev
shell exported), commits it, tags the commit and pushes main with the tag in
one atomic push:

```bash
buddy release:ios                 # v1.0.0-build.1, v1.0.0-build.2, ... (same version, next build)
buddy release:ios --bump patch    # 1.0.0 → 1.0.1, then v1.0.1-build.1
buddy release:ios --bump minor    # or major, or an exact version like 2.0.0
buddy release:ios --dry-run       # print the tag and the GitHub release it would create
```

Every release also creates the tag's GitHub release: titled with the version
and build (`1.0.0 (build 39)`), opening with the TestFlight build the tag
becomes, then the changes since the previous tag, rendered by the same
changelog generator as `CHANGELOG.md`. The token is the one the push used:
`GITHUB_TOKEN` or `GH_TOKEN`, else the GitHub CLI's (`gh auth token`), else the
git credential for github.com. The tag is pushed first, so a release that
cannot be created (no token, an API error) is a warning, not a failed
release; `buddy release:github <tag>` finishes it, and leaves a tag that
already has a release alone. `--skip-github-release` pushes the tag only.
`buddy release` does the same for an app's own `v<version>` tags (the
framework's own releases get theirs from CI).

`--bump` raises the iOS `version` in `config/mobile.ts` (the default behind
an env override, such as `envVars.IOS_APP_VERSION ?? '1.0.0'`) and
`package.json` together. Without it the version stays, which is what you want
until the version is released on the App Store.

The tag is what ships. Commit the generated project
(`storage/framework/mobile/ios`), then set the Xcode Cloud workflow's start
condition to **Tag Changes** with tag prefix `v` and an **Archive - iOS**
action distributing to App Store Connect. Xcode Cloud numbers the builds
itself, and an internal TestFlight group with access to all builds hands each
one to its testers; with TestFlight's automatic updates on, their phones
install it once Apple has processed it.

Xcode Cloud numbers every run, failed ones too, so a count of tags drifts from
the build number TestFlight shows. Give the release an App Store Connect API
key (Users and Access → Integrations → App Store Connect API, App Manager role)
and it tags `v1.0.0-build.<n>` with the number Xcode Cloud will give that
build, and expires the builds it supersedes so TestFlight lists only the
newest (`--keep-builds <n>` keeps more; `--dry-run` shows which would go):

```bash
# .env
APP_STORE_CONNECT_KEY_ID=ABC123DEFG
APP_STORE_CONNECT_ISSUER_ID=00000000-0000-0000-0000-000000000000
APP_STORE_CONNECT_PRIVATE_KEY_PATH=/path/to/AuthKey_ABC123DEFG.p8
```

### Server Docker Image

Build the production server Docker image:

```bash
buddy build:server
# or
buddy prod:server
buddy build:docker
```

### Stacks Framework

Build the entire Stacks framework (for core developers):

```bash
buddy build:stacks
```

### Core Packages

Build core framework packages:

```bash
buddy build:core
```

## Production Aliases

Several `build:*` commands ship a matching `prod:*` alias (there is no bare `prod` command):

```bash
buddy prod:components       # Same as buddy build:components
buddy prod:desktop          # Same as buddy build:desktop
buddy prod:mobile           # Same as buddy build:mobile
buddy prod:ios              # Same as buddy build:ios
buddy prod:android          # Same as buddy build:android
buddy prod:web-components   # Same as buddy build:web-components
buddy prod:frontend         # Same as buddy build:frontend (build:views)
buddy prod:cli              # Same as buddy build:cli
buddy prod:server           # Same as buddy build:server
buddy prod:docs             # Same as buddy build:docs
buddy prod:frontend-static  # Same as buddy build:frontend-static
```

## Examples

### Build Components with Verbose Output

```bash
buddy build:components --verbose
```

### Build Multiple Targets

```bash
# Build specific targets sequentially
buddy build:components && buddy build:functions && buddy build:docs
```

### Build for Specific Project

```bash
buddy build:views --project my-project
```

## Output Locations

Build outputs are placed in the following locations:

| Target | Output Directory |
|--------|-----------------|
| STX Components | `dist/stx/` |
| Web Components | `dist/web-components/` |
| Functions | `dist/functions/` |
| Views | `dist/views/` |
| Documentation | `dist/docs/` |
| Desktop | `dist/desktop/` |

## Build Optimization

Stacks automatically applies production optimizations:

- **Minification** - JavaScript and CSS are minified
- **Tree Shaking** - Unused code is removed
- **Code Splitting** - Code is split into optimal chunks
- **Asset Optimization** - Images and assets are optimized
- **Compression** - Brotli and gzip compression support

## Troubleshooting

### Build Fails with Memory Error

For large projects, you may need to increase Node's memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" buddy build
```

### TypeScript Errors

If you encounter TypeScript errors during build:

```bash
# Run type checking first
buddy test:types

# Fix issues, then rebuild
buddy build
```

### Missing Dependencies

If build fails due to missing dependencies:

```bash
buddy install
buddy build
```

## Related Commands

- [buddy dev](/guide/buddy/dev) - Development server
- [buddy deploy](/guide/buddy/deploy) - Deploy to cloud
- [buddy test](/guide/buddy/test) - Run tests
