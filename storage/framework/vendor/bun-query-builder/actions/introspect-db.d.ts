import type { MigrationPlan, NormalizedColumnType } from '../migrations';
import type { SupportedDialect } from '../types';
/** Map a raw SQL column type to a model attribute type. */
export declare function sqlTypeToAttr(sqlType: string): AttrType;
/** PascalCase, singular model name for a table (`blog_posts` -> `BlogPost`). */
export declare function modelNameForTable(table: string): string;
/** Generate `defineModel(...)` source for one introspected table. */
export declare function generateModelSource(table: string, columns: IntrospectedColumn[]): string;
/**
 * Introspect the configured live database and return a generated model per
 * table. Pass `tables` to limit the set.
 */
export declare function introspectDatabase(opts?: { tables?: string[] }): Promise<IntrospectedModel[]>;
/** Map a raw SQL column type back to a normalized model column type. */
export declare function sqlTypeToNormalized(rawType: string, dialect: SupportedDialect, ctx?: { enumValues?: string[] }): NormalizedColumnType;
/**
 * Read the live database into a full `MigrationPlan`. Tables are read in the
 * dialect-native way (PRAGMA / information_schema / pg_catalog). The internal
 * `migrations` bookkeeping table is excluded.
 */
export declare function buildPlanFromDatabase(dialect?: SupportedDialect, opts?: { tables?: string[] }): Promise<MigrationPlan>;
/**
 * Reverse introspection (stacksjs/bun-query-builder#1047): read a LIVE database
 * and emit `defineModel(...)` source, so an existing schema can be adopted
 * without hand-writing models. Complements the forward `introspect(dir)` which
 * loads models and prints the inferred schema.
 */
export declare interface IntrospectedColumn {
  name: string
  sqlType: string
  nullable: boolean
  isPrimaryKey: boolean
}
export declare interface IntrospectedModel {
  table: string
  modelName: string
  primaryKey: string
  columns: IntrospectedColumn[]
  source: string
}
/** The attribute `type` we map a raw SQL column type to. */
export type AttrType = 'string' | 'number' | 'boolean' | 'datetime' | 'json';
