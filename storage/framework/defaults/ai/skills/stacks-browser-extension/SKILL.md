---
name: stacks-browser-extension
description: Use when scaffolding, building, packaging or preparing store submission for a native Stacks MV3 browser extension, or shipping its rules and content scripts to a WKWebView app. Covers @stacksjs/browser-extension and Chrome/Firefox/Safari/WebKit target boundaries.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Browser extensions

Use the native ExtensionConfig and scaffold/build/package APIs for MV3 targets.
Read the current target and store adapters before planning distribution; a
successful local bundle is not proof of store acceptance or device behavior.

## Build workflow

scaffoldExtensionProject creates the established project layout;
scaffoldSafariApp owns Safari container scaffolding. buildExtension configures
popup/options pages, background/content scripts,
static assets and declarativeNetRequest rules. Native page builds use stx,
resource partials and CSP sanitization rather than embedding arbitrary inline
script. Keep code in permitted bundled entrypoints and minimize permissions.

Target-specific manifest generation, packaging and validation support Chrome
and Firefox. Safari additionally uses container-app scaffolding, resource sync
and xcodebuild on a suitable macOS toolchain. Target limitations are explicit;
do not substitute one browser's package for another.

## WebKit target

`buddy extension:build --target webkit` writes `dist-webkit/` for apps that
embed WKWebView and have no extension runtime: the DNR rulesets (plus
`webkit.dynamicRules` and `webkit.cosmetic` sources) as WebKit content-blocker
lists in `lists/<id>.json`, every content script as a standalone
`WKUserScript` in `scripts/<id>.js`, and a `manifest.json` describing both.
It never changes the Chrome, Firefox or Safari outputs.

The converter is `src/webkit.ts` (`buildWebKitLists`, `convertDnrRule`,
`urlFilterToWebKitRegex`, `regexFilterToWebKit`), importable at runtime as
`@stacksjs/browser-extension/webkit`. Lists split under `maxRulesPerList`
(default 50,000; WebKit refuses more than 150,000) with a stable id and a
content-hash version. What WebKit cannot express (redirect, modifyHeaders,
method/tab/header conditions, `excludedRequestDomains`, lookaround regexes) is
counted in `report.unsupported`; looser or narrower matches in
`report.approximated`. Neither is dropped silently, so read the report.

Isolated-world scripts that call `chrome.runtime` / `chrome.storage` are
bridged to `window.webkit.messageHandlers.<name>`; the host app implements
that handler. The mapping table, ordering rules and message contract are in
[WEBKIT.md](WEBKIT.md). Ship `dist-webkit` to apps through a library package's
`assets` (see `stacks-build`).

## Store preparation and publication

The package includes publish plans and adapters for Chrome Web Store, Firefox
Add-ons/previews and App Store Connect submission. Prepare a reviewable plan,
credentials prerequisites and the actual artifacts before an authorized upload.
Do not upload or submit merely because the build finished. Never put store
credentials into the extension's public files.

Verify generated manifests, CSP, permissions, scripts, packaged file lists,
and target-specific tests. Device and store outcomes need their own evidence.
Source: core/browser-extension/src/{config,manifest,build,package,scaffold,
publish-plan,safari,webkit,webkit-scripts,webkit-build}.ts and store adapters.
Tests cover these same boundaries.
