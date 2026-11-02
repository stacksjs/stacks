# The WebKit target

`buddy extension:build --target webkit` (or `targets: [..., 'webkit']`) builds
an extension for apps that embed WKWebView. Source: `src/webkit.ts` (the
converter), `src/webkit-scripts.ts` (user scripts and the bridge),
`src/webkit-build.ts` (the build). Tests: `tests/webkit.test.ts`,
`tests/webkit-build.test.ts`.

## Config

```ts
defineExtension({
  rules: [{ id: 'static', source: 'src/rules/static.ts' }],   // each becomes a list group
  content: [/* ... */],                                          // each becomes a user script
  webkit: {
    maxRulesPerList: 50_000,                                     // WebKit's own cap is 150,000
    dynamicRules: [{ id: 'dynamic', source: 'src/rules/webkit.ts#dynamicRules' }],   // path#export
    cosmetic: [
      { id: 'cosmetic', source: 'src/rules/webkit.ts#cosmetic' },
      { id: 'cosmetic-consent', source: 'src/rules/webkit.ts#consent', enabled: false },
    ],
    selectorsPerRule: 100,
    messageHandler: 'my-extension',                              // default: the name as a slug
    excludeScripts: [],                                          // by output name, e.g. 'content'
  },
})
```

A source is a module path, or `path#name` for one of its exports (a function
is called). A `dynamicRules` source returns DNR rules (the defaults the extension would
install with `updateDynamicRules`). A `cosmetic` source returns
`WebKitCosmeticRule[]`: `{ selector: string | string[], domains?, excludedDomains? }`.

## Output

```
dist-webkit/
  manifest.json        format 'stacks-webkit', formatVersion 1
  lists/<id>.json      the JSON array for WKContentRuleListStore.compileContentRuleList
  scripts/<id>.js      WKUserScript source
```

`manifest.json` lists `{ id, version, group, kind, enabled, ruleCount, file }`
per list, `{ id, file, matches, excludeMatches, runAt, allFrames,
matchAboutBlank, world, bridged, apis, unsupportedApis }` per script, the
bridge's `{ messageHandler, version }`, and the conversion `report`.

Compile each list under its `id` and recompile only when `version` (a SHA-256
prefix of the rules) changes. `enabled: false` mirrors a ruleset the extension
leaves off by default. `runAt` is `document-start` or `document-end` (DNR's
`document_idle` has no WebKit counterpart). `world: 'page'` is
`WKContentWorld.page`; `isolated` is a content world of the app's own.
`matches` are extension match patterns for the app to test URLs against.

## DNR to WebKit

| DNR | WebKit |
|---|---|
| `urlFilter` `\|\|host^` | `^[a-z][a-z0-9+.-]*://([^/:]*\.)?host[:/]` |
| `urlFilter` `^` / trailing `^` / `*` / `\|` | `[^a-zA-Z0-9_.%-]` / `([^…].*)?$` / `.*` / `^`, `$` |
| `regexFilter` | passed through; `\d`, `\w`, `(?:)`, `{n,m}` rewritten; alternation expanded into one rule per alternative (64 max) |
| `requestDomains` | one host-anchored `url-filter` per domain |
| `initiatorDomains` / `excludedInitiatorDomains` | `if-domain` / `unless-domain` (`*domain`) |
| `domainType` | `load-type` |
| `isUrlFilterCaseSensitive` | `url-filter-is-case-sensitive` |
| `resourceTypes` | `resource-type`; `main_frame` is `document` + `load-context: top-frame` plus a `popup` rule, `sub_frame` is `document` + `load-context: child-frame`; `xmlhttprequest` is `fetch`, `csp_report` is `ping`, `object` is `other` |
| `block` / `allow` / `upgradeScheme` | `block` / `ignore-previous-rules` / `make-https` |
| `allowAllRequests` | `ignore-previous-rules` on `.*`, `if-domain` the page's domain |

DNR leaves top-level documents out when a rule names no resource types; WebKit
includes them, so those rules spell the frames out. Unsupported, and counted
in `report.unsupported`: `redirect`, `modifyHeaders`, request-method, tab and
response-header conditions, `excludedRequestDomains`, regex lookaround or
back-references, exclusions under an included domain, non-ASCII filters, and
cosmetic selectors with procedural (adblock-only) pseudo-classes or broken
syntax.

## Ordering and splitting

`ignore-previous-rules` only lifts rules before it in the same list, and each
list compiles alone while DNR evaluates every ruleset together. So each list is
sorted by DNR priority, then DNR precedence (make-https, block,
allowAllRequests, allow), and every network list repeats the exceptions of all
enabled groups (a disabled group adds its own to its own lists). Exceptions
count toward `maxRulesPerList`. Cosmetic lists receive no network exceptions:
a DNR `allow` never unhides elements in the extension either. To allowlist a
site in the app, leave its lists off that page's content controller or
recompile with a page-wide `ignore-previous-rules`.

Requires a current WebKit (`load-context` and the `fetch`/`websocket`/`other`
resource types).

## The bridge (contract v1)

Isolated-world scripts that touch `chrome.*` are wrapped so `chrome` and
`browser` are the bridge; the page gets no global. Supported: `runtime.sendMessage`,
`runtime.onMessage`, `runtime.id`, `runtime.lastError`,
`storage.{local,sync,session}.{get,set,remove,clear,onChanged}` and
`storage.onChanged`. Anything else is listed in the script's
`unsupportedApis` and fails at runtime.

Register the handler with `WKScriptMessageHandlerWithReply` so `postMessage`
resolves to your reply. Page to app:

| `body.api` | `body.payload` | reply |
|---|---|---|
| `runtime.sendMessage` | `{ message }` | the response, or null |
| `storage.get` | `{ area, keys: null \| string \| string[] \| object }` | the stored items (the bridge fills in object defaults) |
| `storage.set` | `{ area, items }` | null |
| `storage.remove` | `{ area, keys: string[] }` | null |
| `storage.clear` | `{ area }` | null |

Every body has `v: 1`. A rejected reply rejects the call (callback callers see
`chrome.runtime.lastError`). App to page, evaluated in the script's content
world with `callAsyncJavaScript`:

```js
__stacksWebKit[handler].dispatch({ type: 'runtime.message', message, sender }) // resolves to the first response
__stacksWebKit[handler].dispatch({ type: 'storage.changed', area, changes })    // { key: { oldValue, newValue } }
```

## Publishing to apps

Ship `dist-webkit` in a library package and give it a small typed reader in
`resources/functions`:

```ts
// config/library.ts
packages: [{
  name: 'my-blocker',
  include: ['webkit.ts'],
  registry: 'npm',
  prebuild: 'buddy extension:build --target webkit',
  assets: { webkit: 'dist-webkit' },   // lands in dist/webkit/, exported as my-blocker/webkit/*
}]
```

The reader resolves `new URL('./webkit/manifest.json', import.meta.url)`, which
is `dist/webkit/manifest.json` once built.
