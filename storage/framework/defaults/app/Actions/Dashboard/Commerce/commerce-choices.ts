import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import { containsPattern, countOf } from '../Content/content-list'
import type { NamedSearchQuery } from '../named-search'
import type { CustomerChoice, ProductChoice } from './commerce-choice-records'
import { normalizeCustomerChoice, normalizeProductChoice } from './commerce-choice-records'
import type { CommerceSqlRunner } from './commerce-sql'
import { asText, binder, sqlRows } from './commerce-sql'

/**
 * The products and customers a commerce dialog offers, searched by the
 * database (stacksjs/stacks#3218). The waitlist dialogs used to be handed the
 * first 500 of each by name with every page, so an entry could not be made
 * for a product or customer past the 500th.
 *
 * The query is the pickers' usual `q` and `limit` (`parseNamedSearchQuery`):
 * case is ignored, `%` and `_` are characters to find, the answer is bounded,
 * and `total` says how many matched. The choices themselves, and their
 * normalizers, are in commerce-choice-records.ts.
 */
export type { CustomerChoice, ProductChoice } from './commerce-choice-records'

async function search<T>(
  table: 'products' | 'customers',
  columns: string,
  searched: string[],
  query: NamedSearchQuery,
  normalize: (row: Record<string, unknown>) => T,
  run: CommerceSqlRunner,
  dialect: QueryBuilderDialect,
  only: string[] = [],
): Promise<{ choices: T[], total: number }> {
  const { bind, values } = binder(dialect)
  const clauses = [...only]
  if (query.search) {
    const pattern = containsPattern(query.search)
    clauses.push(`(${searched.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')})`)
  }
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
  const [counted, found] = await Promise.all([
    run.unsafe(`SELECT COUNT(*) AS total_count FROM ${table}${where}`, values).execute(),
    // LOWER, so the order is the same on every dialect: each collates case its own way.
    run.unsafe(`SELECT ${columns} FROM ${table}${where} ORDER BY LOWER(COALESCE(name, '')) ASC, id ASC LIMIT ${query.limit}`, values).execute(),
  ])
  return { choices: sqlRows(found).map(normalize), total: countOf(sqlRows(counted)[0]?.total_count) }
}

/** Products by name or id. */
export function searchProductChoices(
  query: NamedSearchQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<{ choices: ProductChoice[], total: number }> {
  return search('products', 'id, name, inventory_count', [`COALESCE(name, '')`, asText('id', dialect)], query, normalizeProductChoice, run, dialect)
}

/**
 * Customers by name, email or phone. `activeOnly` keeps to customers whose
 * status is Active, as the point of sale offers them.
 */
export function searchCustomerChoices(
  query: NamedSearchQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
  options: { activeOnly?: boolean } = {},
): Promise<{ choices: CustomerChoice[], total: number }> {
  // A text comparison: PostgreSQL keeps the status as an enum.
  const only = options.activeOnly ? [`${asText('status', dialect)} = 'Active'`] : []
  return search('customers', 'id, name, email, phone', [`COALESCE(name, '')`, `COALESCE(email, '')`, `COALESCE(phone, '')`], query, normalizeCustomerChoice, run, dialect, only)
}
