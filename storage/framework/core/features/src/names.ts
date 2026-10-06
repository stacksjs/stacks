/**
 * The installable feature bundles, and nothing else.
 *
 * Its own module, with no imports at all, so a consumer that only needs the
 * names does not pull `node:fs` and `@stacksjs/path` with them. That consumer
 * is `@stacksjs/config`, which derives its own feature list from this one and
 * is imported on the earliest path in every process - the manifest half of
 * this package costs about a millisecond there, and this costs nothing.
 *
 * A name here is a bundle with a `<feature>:install` command, a file manifest,
 * a table manifest and migration gating. `auth` is deliberately not one: see
 * `@stacksjs/config`'s feature list, which adds it.
 */
export const FEATURE_NAMES = [
  'dashboard',
  'commerce',
  'cms',
  'forms',
  'marketing',
  'monitoring',
  'realtime',
  'queue',
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]
