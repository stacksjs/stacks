// The models, and their tables, derived rather than listed.
//
// `ModelNames` and `TableNames` were hand-written unions in `@stacksjs/types`:
// 50 model names against the 97 the application had, and 62 table names with
// two duplicates. A list maintained alongside the thing it lists only ever
// drifts one way, and the drift is silent until somebody writes
// `belongsTo: ['Site']` for a model that plainly exists and is told it does not.
//
// The barrel this reads is generated, but for the RUNTIME:
// `injectGlobalAutoImports` imports it to put the models on `globalThis`. So
// this adds no generation step of its own, and cannot drift from what the
// runtime actually has.

/** Every model, by the name the ORM exposes it under. */
type Models = typeof import('../auto-imports/models')

/** A model's own `table`, when it declares one as a literal. */
type TableOf<TModel> = TModel extends { table: infer TTable extends string } ? TTable : never

/** Every table the models write to. */
type Tables = { [K in keyof Models]: TableOf<Models[K]> }[keyof Models]

declare module '@stacksjs/types' {
  interface ModelRegistry extends Record<keyof Models & string, true> {}
  interface TableRegistry extends Record<Tables, true> {}
}

export {}
