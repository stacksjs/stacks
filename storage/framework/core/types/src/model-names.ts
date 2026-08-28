/**
 * Every model this application has, by the name the ORM exposes it under.
 *
 * This used to be a hand-written union, and it was 50 names against the 97 the
 * application actually had - so `belongsTo: ['Site']` was a type error for a
 * model that exists, and had been for as long as nobody added it here. A list
 * maintained alongside the thing it lists only ever drifts one way.
 *
 * `storage/framework/types/models.d.ts` fills the registry below from the
 * models barrel, which is generated for the RUNTIME (`injectGlobalAutoImports`
 * imports it to put the models on `globalThis`), so this adds no generation
 * step of its own and cannot disagree with what the runtime has.
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface ModelRegistry {}

/**
 * A model name, as narrow as the application has made it.
 *
 * Falls back to `string` while the registry is empty. A project whose barrel
 * has not been generated yet has no list to check against, and rejecting every
 * model name until `buddy generate` runs would be worse than checking none.
 */
export type ModelNames = keyof ModelRegistry extends never
  ? string
  : keyof ModelRegistry & string
