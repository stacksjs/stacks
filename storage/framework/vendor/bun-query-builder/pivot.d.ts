import type { ModelRecord, PivotColumnAttribute } from './schema';
import type { SchemaMeta } from './meta';
/**
 * Resolve a `belongsToMany` relation entry to a `ResolvedPivot`. Returns null
 * when the relation key is absent or not a `belongsToMany` on the parent.
 */
export declare function resolvePivot(meta: SchemaMeta, parentTable: string, relationKey: string, options?: ResolvePivotOptions): ResolvedPivot | null;
/**
 * Iterate every declared `belongsToMany` relation across all parent tables and
 * yield each as a `ResolvedPivot`. Useful for migration emission and CLI
 * introspection.
 */
export declare function iterateAllPivots(meta: SchemaMeta, options?: ResolvePivotOptions): Generator<{ parentTable: string, relationKey: string, resolved: ResolvedPivot }>;
export declare interface ResolvedPivot {
  pivotTable: string
  fkParent: string
  fkRelated: string
  pivotColumns: string[]
  pivotColumnDefs: Record<string, PivotColumnAttribute>
  pivotModelName?: string
  timestamps: boolean
  relatedModelName: string
  relatedTable: string
  hasConfig: boolean
}
export declare interface ResolvePivotOptions {
  singularize?: (s: string) => string
  models?: ModelRecord
}
