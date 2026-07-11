import type { OnForeignKeyAction } from './schema';
/**
 * Unwrap a single relation entry to a descriptor, or null if it isn't a valid
 * relation entry. Accepts:
 *   - `'Model'`
 *   - `{ model: 'Model', foreignKey?, onDelete? }`
 */
export declare function normalizeRelationEntry(entry: unknown): NormalizedRelation | null;
/**
 * Flatten a relation declaration into descriptors. Accepts every supported
 * shape: string array, object-in-array, record (name->Model) and record
 * (name->config). Invalid entries are dropped.
 */
export declare function normalizeRelationList(rel: unknown): NormalizedRelation[];
/**
 * A relation entry reduced to the fields the schema/migration layers need.
 *
 * Single source of truth for unwrapping the supported relation-declaration
 * shapes. Previously `meta.ts` (toRecord) and `migrations.ts`
 * (normalizeBelongsTo) each re-implemented this — the exact shape that caused
 * stacksjs/bun-query-builder#1023, and the fix had to be applied twice. See #1042.
 */
export declare interface NormalizedRelation {
  model: string
  foreignKey?: string
  onDelete?: OnForeignKeyAction
}
