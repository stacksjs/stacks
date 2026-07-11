import type { QueryBuilderConfig, SupportedDialect } from './types';
/**
 * Whether a dialect belongs to the MySQL wire-protocol family (MySQL itself or
 * SingleStore). These share `?` placeholders, backtick identifier quoting,
 * `ON DUPLICATE KEY UPDATE` upserts, `LAST_INSERT_ID()` id recovery, and the
 * `YYYY-MM-DD HH:MM:SS` datetime literal shape. Runtime DML branches should key
 * off this helper rather than `dialect === 'mysql'` so SingleStore inherits the
 * same behavior; only DDL (see `SingleStoreDriver`) diverges.
 */
export declare function isMysqlLike(dialect?: SupportedDialect): boolean;
/**
 * Get the placeholder format for the current dialect.
 * PostgreSQL uses $1, $2, $3... while MySQL and SQLite use ?
 */
export declare function getPlaceholder(index: number): string;
/**
 * Generate placeholders for an array of values.
 * PostgreSQL: $1, $2, $3
 * MySQL/SQLite: ?, ?, ?
 */
export declare function getPlaceholders(count: number, startIndex?: number): string;
/**
 * Load the query-builder config from a config file (`query-builder.config.ts`,
 * `.config/query-builder.ts`, etc.) and environment variables via bunfig, then
 * MERGE it into the live, process-wide `config` singleton so every reader
 * (dialect dispatch, placeholders, soft-deletes, the model layer, …) sees it.
 *
 * Call this once at application boot if you keep configuration in a file:
 *
 * ```ts
 * import { getConfig } from 'bun-query-builder'
 * await getConfig() // applies query-builder.config.ts + env to the runtime
 * ```
 *
 * It is intentionally explicit/async: the builder otherwise runs purely off the
 * synchronous `config` singleton (defaults + any `setConfig`), which keeps
 * `bun --compile` and test behavior deterministic — auto-loading a file in the
 * background would make early queries race the load. Previously this wrote the
 * loaded config to a private `_config` variable that nothing else read, so a
 * config file silently never took effect; it now routes through `setConfig`.
 */
export declare function getConfig(): Promise<QueryBuilderConfig>;
export declare function setConfig(userConfig: Partial<QueryBuilderConfig>): void;
export declare const defaultConfig: QueryBuilderConfig;
export declare const config: QueryBuilderConfig;
