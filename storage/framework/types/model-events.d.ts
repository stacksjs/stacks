// Model events, derived rather than listed.
//
// This file used to be generated: 97 models x 8 events, 817 lines, rebuilt by
// `buddy generate:types` and stale the moment a model was added without it.
// None of that is necessary. A mapped type with key remapping turns the models
// barrel into the event map directly, so `User` becoming a model is the same
// event as `'user:created'` existing - not two facts that have to be kept in
// agreement.
//
// The barrel it reads is generated, but for the RUNTIME: `injectGlobalAutoImports`
// imports it to put the models on `globalThis`. So this adds no generation step
// of its own, and cannot drift from what the runtime actually has.

import type { ModelRow } from '@stacksjs/orm'

/** Every model, by the name the ORM exposes it under. */
type Models = typeof import('../auto-imports/models')

/**
 * Fired after the write, with the row.
 *
 * `define-model.ts` dispatches these with `toEventPayload(model)`, which
 * returns `{...attributes}` plus the primary key.
 */
type AfterEvent = 'created' | 'updated' | 'saved' | 'deleted'

/**
 * Fired before the write, with the model object; returning `false` cancels.
 */
type BeforeEvent = 'saving' | 'creating' | 'updating' | 'deleting'

/**
 * `'user:created'`, `'productcategory:saved'` - the model's name lowercased,
 * matching `definition.name.toLowerCase()` in `define-model.ts`.
 */
type ModelAfterEvents = {
  [K in keyof Models & string as `${Lowercase<K>}:${AfterEvent}`]: ModelRow<Models[K]>
}

type ModelBeforeEvents = {
  [K in keyof Models & string as `${Lowercase<K>}:${BeforeEvent}`]: ModelWriteEventOf<Models[K]>
}

/**
 * What a BEFORE event carries: the model object, not the row.
 *
 * `toEventPayload` reading `model?.attributes` is what establishes that the
 * object has one. Typed as far as that goes and no further - the rest of the
 * instance belongs to the query builder.
 */
interface ModelWriteEventOf<TModel> {
  attributes: ModelRow<TModel>
  [key: string]: unknown
}

declare module '@stacksjs/events' {
  interface AppEvents extends ModelAfterEvents, ModelBeforeEvents {}
}

export {}
