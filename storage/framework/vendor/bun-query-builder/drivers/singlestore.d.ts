import { MySQLDriver } from './mysql';
import type { IndexPlan, TablePlan } from '../migrations';
/**
 * SingleStore DDL driver.
 *
 * SingleStore (formerly MemSQL) speaks the MySQL wire protocol, so runtime DML
 * (placeholders, backtick quoting, `ON DUPLICATE KEY UPDATE`, `LAST_INSERT_ID`)
 * is identical — see `isMysqlLike` in `config.ts`. Only the DDL diverges, which
 * is what this driver customizes:
 *
 *  - **Distributed tables.** Rows are hash-partitioned across leaf nodes by a
 *    `SHARD KEY`. When a model declares `shardKey`, we emit it; otherwise
 *    SingleStore shards on the primary key (or a random key for columnstore),
 *    so a plain MySQL-shaped `CREATE TABLE` still works.
 *  - **Storage engine.** `tableKind: 'columnstore'` (default for analytics
 *    workloads) emits `SORT KEY (...)`; `'rowstore'` emits `ROWSTORE`;
 *    `'reference'` emits a `REFERENCE` table (fully replicated, no shard key —
 *    ideal for small dimension tables that get JOINed everywhere).
 *  - **No foreign keys.** SingleStore does not support `FOREIGN KEY`
 *    constraints, so `addForeignKey` is a no-op (referential integrity is an
 *    application concern). This mirrors how the MySQL driver already treats
 *    enums (`createEnumType` → '').
 */
export declare class SingleStoreDriver extends MySQLDriver {
  createTable(table: TablePlan): string;
  addForeignKey(): string;
  createIndex(tableName: string, index: IndexPlan): string;
}
