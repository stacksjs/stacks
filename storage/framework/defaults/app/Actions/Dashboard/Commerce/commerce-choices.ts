import type { QueryBuilderDialect } from '@stacksjs/database/runtime'
import { db, getDatabaseDialect } from '@stacksjs/database/runtime'
import { containsPattern, countOf } from '../Content/content-list'
import type { NamedSearchQuery } from '../named-search'
import {
  commerceEmail,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalString,
  commerceRequiredString,
  commerceValue,
} from './commerce-record'
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
 * and `total` says how many matched.
 */
export interface ProductChoice {
  id: string
  label: string
  detail: string
}

export interface CustomerChoice extends ProductChoice {
  email: string
  phone: string
}

export function normalizeProductChoice(record: any): ProductChoice {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Product')
  const source = `Product ${id}`
  const inventory = commerceNumber(
    commerceValue(record, 'inventory_count', 'inventoryCount'),
    source,
    'inventory_count',
    { min: 0, integer: true },
  )
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: `${inventory} in inventory`,
  }
}

export function normalizeCustomerChoice(record: any): CustomerChoice {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  const email = commerceEmail(commerceValue(record, 'email'), source)
  const phone = commerceOptionalString(commerceValue(record, 'phone'), source, 'phone')
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: email || phone,
    email,
    phone,
  }
}

async function search<T>(
  table: 'products' | 'customers',
  columns: string,
  searched: string[],
  query: NamedSearchQuery,
  normalize: (row: Record<string, unknown>) => T,
  run: CommerceSqlRunner,
  dialect: QueryBuilderDialect,
): Promise<{ choices: T[], total: number }> {
  const { bind, values } = binder(dialect)
  let where = ''
  if (query.search) {
    const pattern = containsPattern(query.search)
    where = ` WHERE ${searched.map(column => `LOWER(${column}) LIKE ${bind(pattern)} ESCAPE '!'`).join(' OR ')}`
  }
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

/** Customers by name, email or phone. */
export function searchCustomerChoices(
  query: NamedSearchQuery,
  run: CommerceSqlRunner = db,
  dialect: QueryBuilderDialect = getDatabaseDialect(),
): Promise<{ choices: CustomerChoice[], total: number }> {
  return search('customers', 'id, name, email, phone', [`COALESCE(name, '')`, `COALESCE(email, '')`, `COALESCE(phone, '')`], query, normalizeCustomerChoice, run, dialect)
}
