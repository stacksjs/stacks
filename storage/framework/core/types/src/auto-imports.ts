// `unplugin-auto-import` isn't a runtime dependency of @stacksjs/types — we
// only re-publish its option shape so users get autocomplete in user-land
// configs. The local type intentionally mirrors the upstream `Options`
// surface as an open record; if/when this package adopts unplugin-auto-import
// as a real dependency, swap this for `import type { Options }` from there.
export interface AutoImportsOptions {
  [key: string]: unknown
}
