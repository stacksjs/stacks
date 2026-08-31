// Avoid ts-collect 0.4.1 and 0.4.2: their published dist is unparseable, so an
// import here took the whole test suite down. Fixed in 0.4.3.
export { collect } from 'ts-collect'

/*
 * The types, not just the function.
 *
 * `collect()` returns `CollectionOperations<T>`, and this package used to
 * export no way to name it. A consumer that wanted to annotate a collection
 * had to reach past this package into `ts-collect` itself, so in practice
 * nobody did, and declarations fell back to whatever could be inferred.
 *
 * That is not free at a package boundary: `bun-plugin-dtsx` could not follow
 * the inferred type out through this re-export and emitted
 * `export declare const quotes: unknown` for `@stacksjs/cli`, which is what
 * made a freshly scaffolded app fail its own `buddy typecheck`
 * (stacksjs/stacks#2389).
 */
export type {
  Collection,
  CollectionMetrics,
  CollectionOperations,
  LazyCollectionOperations,
  PaginationResult,
  StandardDeviationResult,
  ValidationSchema,
} from 'ts-collect'
