/**
 * ORM package exports.
 *
 * Model types are inferred from defineModel() definitions via bun-query-builder's
 * type utilities (InferAttributes, InferRelationNames, etc.).
 *
 * Instead of importing generated types like `PostJsonResponse`, use:
 *   import Post from './models/Post'
 *   type PostAttributes = InferAttributes<typeof Post>
 */

// Re-export prunable utilities
export { prunable, massPrunable, getPrunableConfig } from './utils/prunable'
export type { PrunableOptions } from './utils/prunable'
