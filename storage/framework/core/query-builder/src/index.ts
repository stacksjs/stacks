/**
 * @stacksjs/query-builder
 *
 * This package is a thin wrapper around bun-query-builder.
 * All query building functionality is provided by bun-query-builder.
 */

// Re-export everything from bun-query-builder
export * from 'bun-query-builder'

// For backwards compatibility, export QueryBuilder as an alias
export { createQueryBuilder as QueryBuilder } from 'bun-query-builder'
