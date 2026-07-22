# @stacksjs/browser-extension

Build MV3 browser extensions (Chrome + Firefox + Safari) the Stacks way — the
manifest, content/background scripts, stx pages, `declarativeNetRequest`
rulesets, and store-ready packaging are all derived from a single
`config/extension.ts`. No hand-written `manifest.json`, no per-project build
script. Safari additionally gets macOS, iPhone, and iPad container apps from
one web bundle, with checked-in macOS development and universal App Store
packaging owned by the framework.

## Quick start

```sh
buddy extension:init          # scaffold Chrome + Firefox + Safari, including the Xcode app
buddy extension:init --target safari --name "My Extension" --bundle-id com.example.MyExtension
buddy extension:build         # build all targets → dist/ (+ dist-firefox/)
buddy extension:build --target chrome
buddy extension:build --target safari   # → dist-safari/ (browser.* namespace, safari manifest)
buddy extension:package       # build + zip store-ready archives
```

Use `icons` for full-color store/app branding and `actionIcons` for separate,
usually neutral artwork in the browser toolbar:

```ts
defineExtension({
  icons: { 16: 'icons/icon-16.png', 128: 'icons/icon-128.png' },
  actionIcons: { 16: 'icons/toolbar-16.png', 32: 'icons/toolbar-32.png' },
})
```

## Store publishing

Stacks owns the store-specific upload clients as well as the builds. Chrome
uses Web Store API v2 with a service account; Firefox uses Mozilla's official
`web-ext` client and AMO v5 API; Safari uses App Store Connect and Xcode.

```sh
buddy extension:chrome:status
buddy extension:chrome:publish          # build, zip, upload, submit for review
buddy extension:chrome:publish --upload-only
buddy extension:firefox:publish         # build, submit, sign through AMO
buddy extension:safari:provision        # register Bundle IDs + check app record
buddy extension:safari:publish
buddy extension:safari:submit           # submit an already-uploaded version
```

Chrome reads `CHROME*WEB*STORE*SERVICE*ACCOUNT*PATH` (or
`GOOGLE*APPLICATION*CREDENTIALS`) and the configured
`chromeWebStore.publisherId`/`itemId`. The API only updates existing items, so
create the initial Developer Dashboard item once and link the service-account
email to the publisher account. Firefox reads `AMO*JWT*ISSUER` and
`AMO*JWT*SECRET`; `web-ext` can create the initial listing when
`firefoxAddons.license` and `firefoxAddons.categories` are configured.

For tag-driven publication, call Stacks' reusable workflow from the extension
repository instead of duplicating store orchestration. Expose the optional
manual inputs so a failed or missing GitHub Release can be repaired without
resubmitting builds to the browser stores:

```yaml
on:
  workflow*dispatch:
    inputs:
      github-release-only:
        description: Build packages and create or repair the GitHub Release only
        type: boolean
        default: false
      release-tag:
        description: Existing tag to repair; defaults to v<package.json version>
        type: string
        required: false
  push:
    tags:
      - 'v*'

jobs:
  publish:
    uses: stacksjs/stacks/.github/workflows/browser-extension-release.yml@v0.70.147
    with:
      chrome-publisher-id: ${{ vars.CHROME*WEB*STORE*PUBLISHER*ID }}
      safari-enabled: ${{ vars.ENABLE*SAFARI*PUBLISH == 'true' }}
      publish-stores: ${{ !inputs.github-release-only }}
      release-tag: ${{ inputs.release-tag || '' }}
    secrets:
      CHROME*WEB*STORE*SERVICE*ACCOUNT*JSON: ${{ secrets.CHROME*WEB*STORE*SERVICE*ACCOUNT*JSON }}
      AMO*JWT*ISSUER: ${{ secrets.AMO*JWT*ISSUER }}
      AMO*JWT*SECRET: ${{ secrets.AMO*JWT*SECRET }}
      APP*STORE*CONNECT*API*KEY: ${{ secrets.APP*STORE*CONNECT*API*KEY }}
      APP*STORE*CONNECT*API*KEY*ID: ${{ secrets.APP*STORE*CONNECT*API*KEY*ID }}
      APP*STORE*CONNECT*API*ISSUER*ID: ${{ secrets.APP*STORE*CONNECT*API*ISSUER*ID }}
```

It packages every configured target, publishes Chrome and Firefox in
independent jobs, optionally uploads Safari with stable Xcode, and creates an
idempotent GitHub Release with checksummed packages as soon as validation
succeeds. Store failures cannot suppress the GitHub Release. A manual run with
`github-release-only` skips every store and creates or repairs the release for
the requested existing tag.

## Safari

Safari Web Extensions ship inside Apple container apps, so the safari target
has two halves: the web bundle (`extension:build --target safari`) and the
macOS/iOS apps. The build rewrites promise-style `chrome.*` to `browser.*` (Safari's
`chrome.*` is callback-flavoured) and pins
`browser*specific*settings.safari.strict*min*version` (default 18.4, the first
Safari with MAIN-world content scripts + `match*about*blank`).

```sh
buddy extension:safari:init   # scaffold the Xcode container app into safari/
buddy extension:safari:provision # register both Bundle IDs + check the app record
buddy extension:safari:app    # build configured macOS/iOS apps
buddy extension:safari:app --platform ios # build for iPhone/iPad Simulator
buddy extension:safari:publish # archive + upload every configured Apple platform
buddy extension:safari:submit  # sync listing metadata and submit existing builds
```

Set `safariBundleId` in the config (the appex gets `<safariBundleId>.Extension`)
and `safariTeamId` to the Apple Developer team used for signing. Set
`safariPlatforms: ['macos', 'ios']` for a universal extension; iOS covers both
iPhone and iPad. Stacks generates the current Apple-supported universal Xcode
project from the same built extension, archives both platforms, uploads them
to the same App Store Connect app record, waits for Apple processing, and
selects each processed build on its matching App Store version. Publishing
reads `APP*STORE*CONNECT*API*KEY*ID`, `APP*STORE*CONNECT*API*ISSUER*ID`, and
`APP*STORE*CONNECT*API*KEY*PATH` from the environment. Run with
`--validate-only` to exercise Apple's validation without uploading a build.
List any build output that is not part of the extension (marketing pages,
etc.) in `safariExclude` so it stays out of the appex. The scaffold mirrors
what `xcrun safari-web-extension-converter` generates, so day-to-day work
never needs the converter; `--signed` builds need an Apple Development
identity selected in Xcode.

When `safariAppStore` is configured, publishing also synchronizes the app
description, category, content-rights declaration, pricing, age rating,
territory availability, review contact, export compliance, and required
screenshots. With `submitForReview: true`, the macOS and iOS versions are then
submitted independently to App Review. The workflow is resumable and keeps an
existing active review submission intact.

For device testing, install the generated iOS app from Xcode, then enable the
extension in Settings > Apps > Safari > Extensions. The iOS target supports
iPhone and iPad from iOS 15 onward; the extension's configured Safari minimum
version can require a newer OS.

## Configure

```ts
// config/extension.ts
import { defineExtension } from '@stacksjs/browser-extension'

export default defineExtension({
  name: 'My Extension',
  description: 'Does something useful.',
  geckoId: 'my-ext@example.com',      // required to ship on Firefox
  chromeWebStore: { publisherId: 'publisher-id', itemId: 'extension-id' },
  firefoxAddons: { license: 'MIT', categories: ['privacy-security'] },
  safariBundleId: 'com.example.MyExtension', // Safari container app bundle id
  safariTeamId: 'TEAM123456',
  safariPlatforms: ['macos', 'ios'], // iOS includes iPhone and iPad
  safariAppCategory: 'public.app-category.utilities',
  safariAppStore: {
    subtitle: 'Fast, private blocking',
    privacyPolicyUrl: 'https://example.com/privacy',
    description: 'A private Safari extension.',
    keywords: 'privacy,blocking',
    supportUrl: 'https://example.com/support',
    copyright: '2026 Example',
    primaryCategory: 'UTILITIES',
    contentRightsDeclaration: 'DOES*NOT*USE*THIRD*PARTY*CONTENT',
    price: '0',
    reviewContact: {
      firstName: 'App', lastName: 'Reviewer',
      phone: '+1 555-555-0100', email: 'review@example.com',
    },
    screenshots: {
      APP*DESKTOP: ['resources/store/macos.png'],
      APP*IPHONE*67: ['resources/store/iphone.png'],
      APP*IPAD*PRO*3GEN*129: ['resources/store/ipad.png'],
    },
    submitForReview: true,
  },
  targets: ['chrome', 'firefox'],

  background: 'src/background/index.ts',
  content: [
    { entry: 'src/content/index.ts', matches: ['<all*urls>'], runAt: 'document*start' },
    // world: 'MAIN' runs in the page's own JS context (patch page globals)
    { entry: 'src/content/inpage.ts', matches: ['*://example.com/*'], world: 'MAIN' },
  ],
  pages: {
    popup: { template: 'pages/popup.stx', script: 'src/ui/popup.ts' },
    options: { template: 'pages/options.stx', script: 'src/ui/options.ts' },
  },
  icons: { 16: 'icons/icon-16.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
  public: 'public',                    // copied verbatim into the build
  assets: { 'styles.css': 'src/ui/styles.css' }, // extra file copies

  // declarativeNetRequest — compiled from a module whose default export
  // returns the rules array, written to rules/<id>.json:
  rules: [{ id: 'static*rules', source: 'src/rules/static.ts' }],

  manifest: {
    permissions: ['declarativeNetRequest', 'storage', 'tabs'],
    hostPermissions: ['http://*/*', 'https://*/*'],
    minimumChromeVersion: '111',
    firefoxMinVersion: '142.0',
    safariMinVersion: '18.4',
    webAccessibleResources: [{ resources: ['stubs/*.js'], matches: ['<all*urls>'] }],
  },

  // App-specific post-processing the generic build can't express:
  hooks: {
    async postBuild({ outdir, target }) { /* … */ },
  },
})
```

## What the build does

Per target it: copies `public/**` + `assets`, bundles page scripts, builds the
stx pages to HTML (**sanitized for the extension CSP** — inline scripts/styles
stripped, asset paths made relative, stx dev-chunks removed), bundles
content/background scripts as classic **IIFE** bundles (esm would leak
top-level vars as page globals), compiles each ruleset's `source` to
`rules/<id>.json`, writes `manifest.json` (per-target: Chrome `service*worker`
vs Firefox event-page + `browser*specific*settings.gecko`), and runs your
`hooks.postBuild`.

## Programmatic API

```ts
import {
  buildExtension,
  buildAllTargets,
  packageExtension,
  publishChromeExtension,
  publishFirefoxExtension,
  generateManifest,
  rewriteBrowserNamespace,
  scaffoldSafariApp,
  syncSafariResources,
  buildSafariApp,
  buildSafariUniversalApp,
  createSafariUniversalProject,
} from '@stacksjs/browser-extension'
```
