# @stacksjs/browser-extension

Build MV3 browser extensions (Chrome + Firefox) the Stacks way — the manifest,
content/background scripts, stx pages, `declarativeNetRequest` rulesets, and
store-ready packaging are all derived from a single `config/extension.ts`. No
hand-written `manifest.json`, no per-project build script.

## Quick start

```sh
buddy extension:init          # scaffold config/extension.ts + starter files
buddy extension:build         # build all targets → dist/ (+ dist-firefox/)
buddy extension:build --target chrome
buddy extension:package       # build + zip store-ready archives
```

## Configure

```ts
// config/extension.ts
import { defineExtension } from '@stacksjs/browser-extension'

export default defineExtension({
  name: 'My Extension',
  description: 'Does something useful.',
  geckoId: 'my-ext@example.com',      // required to ship on Firefox
  targets: ['chrome', 'firefox'],

  background: 'src/background/index.ts',
  content: [
    { entry: 'src/content/index.ts', matches: ['<all_urls>'], runAt: 'document_start' },
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
  rules: [{ id: 'static_rules', source: 'src/rules/static.ts' }],

  manifest: {
    permissions: ['declarativeNetRequest', 'storage', 'tabs'],
    hostPermissions: ['http://*/*', 'https://*/*'],
    minimumChromeVersion: '111',
    firefoxMinVersion: '140.0',
    webAccessibleResources: [{ resources: ['stubs/*.js'], matches: ['<all_urls>'] }],
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
`rules/<id>.json`, writes `manifest.json` (per-target: Chrome `service_worker`
vs Firefox event-page + `browser_specific_settings.gecko`), and runs your
`hooks.postBuild`.

## Programmatic API

```ts
import { buildExtension, buildAllTargets, packageExtension, generateManifest } from '@stacksjs/browser-extension'
```
