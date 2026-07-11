import type { DatabaseSchema, ModelRecord } from './schema';
export declare function buildDatabaseSchema<MRecord extends ModelRecord>(models: MRecord): BuildDatabaseSchema<MRecord>;
export type BuildDatabaseSchema<MRecord extends ModelRecord> = DatabaseSchema<MRecord>;
export type TablesFromSchema<DB> = keyof DB & string;
export type ColumnsOf<DB, TTable extends keyof DB & string> = DB[TTable] extends { columns: infer C }
  ? C
  : never;
