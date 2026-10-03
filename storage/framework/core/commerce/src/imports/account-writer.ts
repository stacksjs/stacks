import type { AccountAdapter, AccountCustomer, AccountFetchOptions, AccountOrder, AccountOrderLine } from './account-types'
import type { CatalogWarning } from './types'
import type { ImportAction, ImportCounts } from './writer'
import { db, sqlHelpers } from '@stacksjs/database/runtime'
import { env } from '@stacksjs/env'
import { formatDate } from '@stacksjs/orm'
import { DEFAULT_CUSTOMER_AVATAR } from '../customers/store'
import { normalizeStoreUrl, storeHost } from './http'
import { catalogUuid } from './identity'

/**
 * Writing imported customers and orders into the built-in commerce tables.
 *
 * Where each field lands, given the columns those tables actually have:
 *
 * | Source                          | Column                                              |
 * |---------------------------------|-----------------------------------------------------|
 * | customer email (trim, lowercase)| `customers.email`, the deduplication key            |
 * | customer id + store host        | `customers.uuid` on create (UUIDv5, `identity.ts`)  |
 * | first + last name               | `customers.name` (the email when there is none)     |
 * | phone                           | `customers.phone`                                   |
 * | lifetime spend, when reported   | `customers.total_spent`, integer minor units        |
 * | last order date, when reported  | `customers.last_order`                              |
 * | account disabled (Shopware)     | `customers.status` `Inactive`                       |
 * | order id + store host           | `orders.uuid` (UUIDv5)                              |
 * | mapped status                   | `orders.status` (the `OrderStatus` vocabulary)      |
 * | currency                        | `orders.currency`, per order                        |
 * | total / tax / discount / shipping / tip | `orders.total_amount` / `tax_amount` / `discount_amount` / `delivery_fee` / `tip_amount`, minor units |
 * | shipping address, one line      | `orders.delivery_address`                           |
 * | customer note                   | `orders.special_instructions`                       |
 * | placed at                       | `orders.created_at`                                 |
 * | each line                       | `order_items`: quantity, unit `price`, `product_id` |
 * | line label and SKU              | `order_items.special_instructions`                  |
 *
 * Customers are deduplicated by email, case-insensitively. A customer is
 * matched first by the uuid an earlier run derived from its source id (so a
 * changed email updates the row instead of adding one), then by email, so a
 * customer who already exists in Stacks (a checkout, another store) is updated
 * rather than duplicated. Nothing password- or card-shaped is ever written:
 * the normalized records have no field for either.
 *
 * Orders are matched on their derived uuid. A re-run updates the order and
 * replaces its lines, since `order_items` has no identity column of its own;
 * the lines of an imported order belong to the source. A line is linked to the
 * product the catalog import wrote, through the same deterministic identities
 * (`catalogUuid`). A line whose product is not in Stacks yet is kept, with no
 * `product_id`, its label and price intact, and reported: import the catalog,
 * re-run the order import, and the lines link.
 *
 * Writes go through the query builder, not the models, so importing a store's
 * history fires no `order:created` events or emails to its customers.
 */

export interface CustomerRow {
  uuid?: string
  name: string
  email?: string
  phone?: string | null
  total_spent?: number
  last_order?: string | null
  status?: 'Active' | 'Inactive'
  avatar?: string
  created_at?: string
  updated_at: string
}

export interface OrderRow {
  uuid: string
  status: string
  total_amount: number
  currency: string
  tax_amount: number
  discount_amount: number
  delivery_fee: number
  tip_amount: number
  order_type: string
  delivery_address: string | null
  special_instructions: string | null
  customer_id?: number | null
  created_at: string
  updated_at: string
}

export interface OrderItemRow {
  order_id: number
  product_id: number | null
  quantity: number
  /** One unit, integer minor units of the order's currency. */
  price: number
  special_instructions: string
  created_at: string
  updated_at: string
}

export interface ExistingCustomer {
  id: number
  uuid: string | null
  email: string
}

/**
 * Where the importer reads and writes customers and orders. The database
 * implementation is below; tests and `--dry-run` use the in-memory and
 * read-only ones. Every `find*` takes a whole page's keys at once.
 */
export interface AccountRepository {
  /** Customers whose uuid is among `uuids` or whose email matches one of `emails` case-insensitively. */
  findCustomers: (query: { uuids: string[], emails: string[] }) => Promise<ExistingCustomer[]>
  createCustomer: (row: CustomerRow) => Promise<number>
  updateCustomer: (id: number, row: CustomerRow) => Promise<void>
  findOrders: (uuids: string[]) => Promise<Map<string, number>>
  createOrder: (row: OrderRow) => Promise<number>
  updateOrder: (id: number, row: Omit<OrderRow, 'uuid'>) => Promise<void>
  /** Replace every line of `orderId` with `rows`. */
  replaceOrderItems: (orderId: number, rows: OrderItemRow[]) => Promise<void>
  /** Product ids by uuid, for the catalog rows that exist. */
  findProducts: (uuids: string[]) => Promise<Map<string, number>>
  /** The `product_id` of each variant that exists, by the variant's uuid. */
  findVariantProducts: (uuids: string[]) => Promise<Map<string, number>>
  /** Run `work` atomically, so an order never lands without its lines. */
  transaction?: <T>(work: (repository: AccountRepository) => Promise<T>) => Promise<T>
}

/** `customers.name` is a 255-character string. */
const NAME_MAX = 255

export interface ImportedCustomer {
  action: ImportAction
  externalId: string | null
  email: string
  name: string
  /** How an existing row was found: by the uuid an earlier import gave it, or by email. */
  matchedBy: 'uuid' | 'email' | null
}

export interface ImportedOrder {
  action: ImportAction
  externalId: string
  number: string | null
  status: string
  sourceStatus: string
  totalMinor: number
  currency: string
  lines: number
  /** Lines whose product is not in Stacks (yet). */
  unlinkedLines: number
  customerEmail: string | null
}

export interface CustomerImportResult {
  source: string
  storeUrl: string
  dryRun: boolean
  pages: string[]
  customers: ImportedCustomer[]
  counts: {
    customers: ImportCounts
    /** Source records that shared an email with one already imported this run. */
    merged: number
  }
  warnings: CatalogWarning[]
}

export interface OrderImportResult {
  source: string
  storeUrl: string
  dryRun: boolean
  pages: string[]
  orders: ImportedOrder[]
  counts: {
    orders: ImportCounts
    /** Customers created from an order because no customer had its email. */
    customers: ImportCounts
    lines: { linked: number, unlinked: number }
    duplicates: number
  }
  currencies: string[]
  warnings: CatalogWarning[]
}

interface AccountImportOptions extends AccountFetchOptions {
  adapter: AccountAdapter
  storeUrl: string
  repository: AccountRepository
  /** Recorded in the result; the repository decides whether anything is written. */
  dryRun?: boolean
  /** Injected clock, for deterministic tests. */
  now?: () => Date
}

export interface ImportCustomersOptions extends AccountImportOptions {
  onCustomer?: (customer: ImportedCustomer) => void
}

export interface ImportOrdersOptions extends AccountImportOptions {
  onOrder?: (order: ImportedOrder) => void
}

/** The uuid a customer gets when an import creates it: from the source id, else from the email. */
export function customerUuid(source: string, host: string, externalId: string | null, email: string): string {
  return catalogUuid(source, host, 'customer', externalId ?? `email:${email}`)
}

function stamp(iso: string | null): string | null {
  return iso ? formatDate(new Date(iso)) : null
}

/** The `customers` row for an imported customer. Pure. */
export function customerRow(customer: AccountCustomer, uuid: string, now: string, mode: 'create' | 'update'): CustomerRow {
  const row: CustomerRow = { name: customer.name.slice(0, NAME_MAX), updated_at: now }

  if (mode === 'create') {
    row.uuid = uuid
    row.email = customer.email
    row.phone = customer.phone
    row.total_spent = customer.totalSpentMinor ?? 0
    row.last_order = stamp(customer.lastOrderAt)
    row.status = customer.active === false ? 'Inactive' : 'Active'
    row.avatar = customer.avatarUrl ?? DEFAULT_CUSTOMER_AVATAR
    row.created_at = stamp(customer.createdAt) ?? now
    return row
  }

  // Only overwrite what the source actually told us. The avatar is the
  // merchant's once the row exists.
  if (customer.phone !== null)
    row.phone = customer.phone
  if (customer.totalSpentMinor !== null)
    row.total_spent = customer.totalSpentMinor
  if (customer.lastOrderAt !== null)
    row.last_order = stamp(customer.lastOrderAt)
  if (customer.active !== null)
    row.status = customer.active ? 'Active' : 'Inactive'
  return row
}

/** `Name (SKU X)`: what `order_items.special_instructions` keeps of a line. */
export function lineLabel(line: AccountOrderLine): string {
  return line.sku ? `${line.name} (SKU ${line.sku})` : line.name
}

/** The `orders` row for an imported order. Pure. */
export function orderRow(order: AccountOrder, host: string, customerId: number | null, now: string): OrderRow {
  const row: OrderRow = {
    uuid: catalogUuid(order.source, host, 'order', order.externalId),
    status: order.status,
    total_amount: order.totalMinor,
    currency: order.currency,
    tax_amount: order.taxMinor,
    discount_amount: order.discountMinor,
    delivery_fee: order.shippingMinor,
    tip_amount: order.tipMinor,
    // The order types are a restaurant's: an order that ships is a delivery,
    // one that does not (digital, collected) is closest to takeout.
    order_type: order.shippingAddress ? 'DELIVERY' : 'TAKEOUT',
    delivery_address: order.shippingAddress,
    special_instructions: order.note,
    created_at: stamp(order.placedAt) ?? now,
    updated_at: now,
  }
  // A customer the import cannot resolve leaves any existing link alone.
  if (customerId !== null)
    row.customer_id = customerId
  return row
}

/**
 * Resolves customers to row ids by uuid, then by email, across a whole run.
 * Lookups are batched per page; rows created during the run are remembered so
 * the next order for the same email finds them without a query.
 */
class CustomerIndex {
  private readonly byUuid = new Map<string, number>()
  private readonly byEmail = new Map<string, number>()

  async load(repository: AccountRepository, keys: Array<{ uuid: string | null, email: string | null }>): Promise<void> {
    const uuids = [...new Set(keys.map(key => key.uuid).filter((uuid): uuid is string => uuid !== null && !this.byUuid.has(uuid)))]
    const emails = [...new Set(keys.map(key => key.email).filter((email): email is string => email !== null && !this.byEmail.has(email)))]
    if (uuids.length === 0 && emails.length === 0)
      return
    for (const row of await repository.findCustomers({ uuids, emails }))
      this.remember(row.id, row.uuid, row.email)
  }

  remember(id: number, uuid: string | null, email: string | null): void {
    if (uuid)
      this.byUuid.set(uuid, id)
    if (email)
      this.byEmail.set(email.trim().toLowerCase(), id)
  }

  find(uuid: string | null, email: string | null): { id: number, matchedBy: 'uuid' | 'email' } | null {
    const byUuid = uuid ? this.byUuid.get(uuid) : undefined
    if (byUuid !== undefined)
      return { id: byUuid, matchedBy: 'uuid' }
    const byEmail = email ? this.byEmail.get(email) : undefined
    return byEmail !== undefined ? { id: byEmail, matchedBy: 'email' } : null
  }

  /** Whether `email` belongs to a customer other than `id`. */
  emailTakenByOther(email: string, id: number): boolean {
    const holder = this.byEmail.get(email)
    return holder !== undefined && holder !== id
  }
}

function base(options: AccountImportOptions): { storeUrl: string, host: string, clock: () => Date, fetchOptions: AccountFetchOptions } {
  const storeUrl = normalizeStoreUrl(options.storeUrl)
  return {
    storeUrl,
    host: storeHost(storeUrl),
    clock: options.now ?? (() => new Date()),
    fetchOptions: {
      credentials: options.credentials,
      limit: options.limit,
      fetch: options.fetch,
      currency: options.currency,
      adminUrl: options.adminUrl,
      sleep: options.sleep,
    },
  }
}

/**
 * Fetch a store's customers through `adapter` and upsert them via
 * `repository`, deduplicated by email. Idempotent: a second run over an
 * unchanged store updates every row and creates none.
 */
export async function importCustomers(options: ImportCustomersOptions): Promise<CustomerImportResult> {
  const { storeUrl, host, clock, fetchOptions } = base(options)
  const { adapter, repository } = options
  const index = new CustomerIndex()
  const seenEmails = new Set<string>()

  const result: CustomerImportResult = {
    source: adapter.name,
    storeUrl,
    dryRun: options.dryRun === true,
    pages: [],
    customers: [],
    counts: { customers: { created: 0, updated: 0 }, merged: 0 },
    warnings: [],
  }

  async function write(customer: AccountCustomer, repo: AccountRepository): Promise<ImportedCustomer> {
    const now = formatDate(clock())
    const uuid = customerUuid(customer.source, host, customer.externalId, customer.email)
    const found = index.find(uuid, customer.email)

    if (!found) {
      const id = await repo.createCustomer(customerRow(customer, uuid, now, 'create'))
      index.remember(id, uuid, customer.email)
      return { action: 'create', externalId: customer.externalId, email: customer.email, name: customer.name, matchedBy: null }
    }

    const row = customerRow(customer, uuid, now, 'update')
    // Found by its uuid with a new email at the source: follow it, unless
    // another customer already holds that address.
    if (found.matchedBy === 'uuid') {
      if (index.emailTakenByOther(customer.email, found.id))
        result.warnings.push({ externalId: customer.externalId ?? undefined, message: `email changed to ${customer.email}, which another customer already has; kept the old address` })
      else
        row.email = customer.email
    }
    await repo.updateCustomer(found.id, row)
    index.remember(found.id, null, customer.email)
    return { action: 'update', externalId: customer.externalId, email: customer.email, name: customer.name, matchedBy: found.matchedBy }
  }

  for await (const page of adapter.customers(storeUrl, fetchOptions)) {
    result.pages.push(page.url)
    result.warnings.push(...page.warnings)

    const fresh: AccountCustomer[] = []
    for (const customer of page.items) {
      // Shopware creates a guest account per checkout, so one shopper can be
      // several source customers. The first one this run wins.
      if (seenEmails.has(customer.email)) {
        result.counts.merged++
        continue
      }
      seenEmails.add(customer.email)
      fresh.push(customer)
    }

    await index.load(repository, fresh.map(customer => ({ uuid: customerUuid(customer.source, host, customer.externalId, customer.email), email: customer.email })))

    for (const customer of fresh) {
      const imported = await write(customer, repository)
      result.counts.customers[imported.action === 'create' ? 'created' : 'updated']++
      result.customers.push(imported)
      options.onCustomer?.(imported)
    }
  }

  if (result.counts.merged > 0)
    result.warnings.push({ message: `${result.counts.merged} source customer${result.counts.merged === 1 ? '' : 's'} shared an email with another and ${result.counts.merged === 1 ? 'was' : 'were'} merged into one Stacks customer` })

  return result
}

/**
 * Fetch a store's orders through `adapter` and upsert them, with their lines,
 * via `repository`. Each order's customer is the Stacks customer with its
 * email (created from the order when there is none); each line links to the
 * product the catalog import wrote, when it exists.
 */
export async function importOrders(options: ImportOrdersOptions): Promise<OrderImportResult> {
  const { storeUrl, host, clock, fetchOptions } = base(options)
  const { adapter, repository } = options
  const index = new CustomerIndex()
  const seenOrders = new Set<string>()
  const currencies = new Set<string>()
  const unlinkedExamples = new Set<string>()

  const result: OrderImportResult = {
    source: adapter.name,
    storeUrl,
    dryRun: options.dryRun === true,
    pages: [],
    orders: [],
    counts: {
      orders: { created: 0, updated: 0 },
      customers: { created: 0, updated: 0 },
      lines: { linked: 0, unlinked: 0 },
      duplicates: 0,
    },
    currencies: [],
    warnings: [],
  }

  const productUuid = (order: AccountOrder, id: string) => catalogUuid(order.source, host, 'product', id)
  const variantUuid = (order: AccountOrder, id: string) => catalogUuid(order.source, host, 'variant', id)
  /** The uuid the customer import gave this order's customer, or would give a guest. */
  function orderCustomerUuid(order: AccountOrder): string | null {
    const customer = order.customer
    if (customer?.externalId)
      return customerUuid(order.source, host, customer.externalId, customer.email ?? '')
    return customer?.email ? customerUuid(order.source, host, null, customer.email) : null
  }

  async function customerFor(order: AccountOrder, repo: AccountRepository, now: string): Promise<number | null> {
    const customer = order.customer
    if (!customer)
      return null
    const uuid = orderCustomerUuid(order)
    const found = index.find(uuid, customer.email)
    if (found)
      return found.id
    if (!customer.email) {
      result.warnings.push({ externalId: order.externalId, message: `order ${order.number ?? order.externalId} has no customer email; imported without a customer` })
      return null
    }

    // A guest, or a customer not imported yet: the order is all there is.
    const id = await repo.createCustomer(customerRow({
      source: order.source,
      externalId: customer.externalId,
      email: customer.email,
      name: customer.name ?? customer.email,
      phone: customer.phone,
      active: null,
      totalSpentMinor: null,
      currency: null,
      lastOrderAt: order.placedAt,
      avatarUrl: null,
      createdAt: order.placedAt,
    }, uuid!, now, 'create'))
    index.remember(id, uuid, customer.email)
    result.counts.customers.created++
    return id
  }

  async function write(order: AccountOrder, repo: AccountRepository, known: { orders: Map<string, number>, products: Map<string, number>, variants: Map<string, number> }): Promise<ImportedOrder> {
    const now = formatDate(clock())
    const customerId = await customerFor(order, repo, now)
    const row = orderRow(order, host, customerId, now)
    const existing = known.orders.get(row.uuid)

    let orderId: number
    if (existing === undefined) {
      orderId = await repo.createOrder(row)
    }
    else {
      orderId = existing
      const changes: Partial<OrderRow> = { ...row }
      delete changes.uuid
      await repo.updateOrder(orderId, changes as Omit<OrderRow, 'uuid'>)
    }

    let unlinked = 0
    const items: OrderItemRow[] = order.lines.map((line) => {
      const productId = (line.productExternalId ? known.products.get(productUuid(order, line.productExternalId)) : undefined)
        ?? (line.variantExternalId ? known.variants.get(variantUuid(order, line.variantExternalId)) : undefined)
        ?? null
      if (productId === null) {
        unlinked++
        if (unlinkedExamples.size < 5)
          unlinkedExamples.add(lineLabel(line))
      }
      return {
        order_id: orderId,
        product_id: productId,
        quantity: line.quantity,
        price: line.unitPriceMinor,
        special_instructions: lineLabel(line),
        created_at: now,
        updated_at: now,
      }
    })
    await repo.replaceOrderItems(orderId, items)

    return {
      action: existing === undefined ? 'create' : 'update',
      externalId: order.externalId,
      number: order.number,
      status: order.status,
      sourceStatus: order.sourceStatus,
      totalMinor: order.totalMinor,
      currency: order.currency,
      lines: items.length,
      unlinkedLines: unlinked,
      customerEmail: order.customer?.email ?? null,
    }
  }

  for await (const page of adapter.orders(storeUrl, fetchOptions)) {
    result.pages.push(page.url)
    result.warnings.push(...page.warnings)

    const fresh = page.items.filter((order) => {
      if (!seenOrders.has(order.externalId)) {
        seenOrders.add(order.externalId)
        return true
      }
      result.counts.duplicates++
      return false
    })

    // One lookup per table per page, never one per order or line.
    const orderUuids = fresh.map(order => catalogUuid(order.source, host, 'order', order.externalId))
    const productUuids = [...new Set(fresh.flatMap(order => order.lines.flatMap(line => line.productExternalId ? [productUuid(order, line.productExternalId)] : [])))]
    const variantUuids = [...new Set(fresh.flatMap(order => order.lines.flatMap(line => line.variantExternalId ? [variantUuid(order, line.variantExternalId)] : [])))]
    const known = {
      orders: orderUuids.length > 0 ? await repository.findOrders(orderUuids) : new Map<string, number>(),
      products: productUuids.length > 0 ? await repository.findProducts(productUuids) : new Map<string, number>(),
      variants: variantUuids.length > 0 ? await repository.findVariantProducts(variantUuids) : new Map<string, number>(),
    }
    await index.load(repository, fresh.map(order => ({ uuid: orderCustomerUuid(order), email: order.customer?.email ?? null })))

    for (const order of fresh) {
      currencies.add(order.currency)
      const imported = repository.transaction
        ? await repository.transaction(repo => write(order, repo, known))
        : await write(order, repository, known)

      result.counts.orders[imported.action === 'create' ? 'created' : 'updated']++
      result.counts.lines.linked += imported.lines - imported.unlinkedLines
      result.counts.lines.unlinked += imported.unlinkedLines
      result.orders.push(imported)
      options.onOrder?.(imported)
    }
  }

  result.currencies = [...currencies].sort()
  if (result.counts.lines.unlinked > 0) {
    const examples = [...unlinkedExamples].map(label => `"${label}"`).join(', ')
    result.warnings.push({ message: `${result.counts.lines.unlinked} order line${result.counts.lines.unlinked === 1 ? '' : 's'} reference products not in Stacks (e.g. ${examples}); kept with their label and price but no product link. Import the catalog (buddy commerce:import <url> --from ${adapter.name}), then re-run the order import to link them.` })
  }

  return result
}

/**
 * A repository over the commerce tables, via the query builder.
 *
 * Inserts are read back by `uuid`, which works on every dialect. Emails are
 * compared with `LOWER()` on both sides, because rows created by checkout or
 * the dashboard keep whatever case the shopper typed.
 */
export function createDatabaseAccountRepository(connection: any = db): AccountRepository {
  async function idByUuid(table: string, uuid: string): Promise<number> {
    const row = await connection.selectFrom(table).where('uuid', '=', uuid).select('id').executeTakeFirst()
    if (!row)
      throw new Error(`Inserted a row into ${table} but could not read it back (uuid ${uuid})`)
    return Number(row.id)
  }

  async function chunked<T>(values: string[], read: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
    const rows: T[] = []
    for (let start = 0; start < values.length; start += 500)
      rows.push(...await read(values.slice(start, start + 500)))
    return rows
  }

  const repository: AccountRepository = {
    async findCustomers({ uuids, emails }) {
      const byUuid = await chunked(uuids, chunk => connection.selectFrom('customers').where('uuid', 'in', chunk).select(['id', 'uuid', 'email']).execute())
      const param = sqlHelpers(env.DB_CONNECTION || 'sqlite').param
      const byEmail = await chunked(emails.map(email => email.trim().toLowerCase()), async (chunk) => {
        const placeholders = chunk.map((_, index) => param(index + 1)).join(', ')
        const rows = await connection.unsafe(`SELECT id, uuid, email FROM customers WHERE LOWER(email) IN (${placeholders})`, chunk)
        return Array.isArray(rows) ? rows : []
      })
      return [...byUuid, ...byEmail].map((row: any) => ({ id: Number(row.id), uuid: row.uuid ?? null, email: String(row.email) }))
    },
    async createCustomer(row) {
      await connection.insertInto('customers').values(row).execute()
      return idByUuid('customers', row.uuid!)
    },
    async updateCustomer(id, row) {
      await connection.updateTable('customers').set(row).where('id', '=', id).execute()
    },
    async findOrders(uuids) {
      const rows = await chunked(uuids, chunk => connection.selectFrom('orders').where('uuid', 'in', chunk).select(['id', 'uuid']).execute())
      return new Map(rows.map((row: any) => [String(row.uuid), Number(row.id)]))
    },
    async createOrder(row) {
      await connection.insertInto('orders').values(row).execute()
      return idByUuid('orders', row.uuid)
    },
    async updateOrder(id, row) {
      await connection.updateTable('orders').set(row).where('id', '=', id).execute()
    },
    async replaceOrderItems(orderId, rows) {
      await connection.deleteFrom('order_items').where('order_id', '=', orderId).execute()
      if (rows.length > 0)
        await connection.insertInto('order_items').values(rows).execute()
    },
    async findProducts(uuids) {
      const rows = await chunked(uuids, chunk => connection.selectFrom('products').where('uuid', 'in', chunk).select(['id', 'uuid']).execute())
      return new Map(rows.map((row: any) => [String(row.uuid), Number(row.id)]))
    },
    async findVariantProducts(uuids) {
      const rows = await chunked(uuids, chunk => connection.selectFrom('product_variants').where('uuid', 'in', chunk).select(['uuid', 'product_id']).execute())
      return new Map(rows.filter((row: any) => row.product_id !== null && row.product_id !== undefined).map((row: any) => [String(row.uuid), Number(row.product_id)]))
    },
  }

  if (connection === db)
    repository.transaction = work => db.transaction((trx: any) => work(createDatabaseAccountRepository(trx)))

  return repository
}

/**
 * A repository that keeps rows in memory. Pass the catalog memory
 * repository's `tables` to share its products and variants, as a real
 * database would.
 */
export function createMemoryAccountRepository(shared: { tables: Record<string, Array<Record<string, any>>> } = { tables: {} }): AccountRepository & { tables: Record<string, Array<Record<string, any>>> } {
  const tables = shared.tables
  for (const table of ['customers', 'orders', 'order_items', 'products', 'product_variants'])
    tables[table] ??= []

  function insert(table: string, row: object): number {
    const rows = tables[table]!
    const id = rows.reduce((max, entry) => Math.max(max, Number(entry.id)), 0) + 1
    rows.push({ id, ...row })
    return id
  }

  function update(table: string, id: number, row: object): void {
    const target = tables[table]!.find(entry => entry.id === id)
    if (target)
      Object.assign(target, row)
  }

  const byUuid = (table: string, uuids: string[]) => new Map(tables[table]!.filter(row => uuids.includes(row.uuid)).map(row => [row.uuid as string, row.id as number]))

  return {
    tables,
    findCustomers: async ({ uuids, emails }) => tables.customers!
      .filter(row => uuids.includes(row.uuid) || emails.includes(String(row.email).trim().toLowerCase()))
      .map(row => ({ id: row.id, uuid: row.uuid ?? null, email: row.email })),
    createCustomer: async (row) => {
      if (tables.customers!.some(existing => existing.email === row.email))
        throw new Error(`UNIQUE constraint failed: customers.email (${row.email})`)
      return insert('customers', row)
    },
    updateCustomer: async (id, row) => update('customers', id, row),
    findOrders: async uuids => byUuid('orders', uuids),
    createOrder: async row => insert('orders', row),
    updateOrder: async (id, row) => update('orders', id, row),
    replaceOrderItems: async (orderId, rows) => {
      tables.order_items = tables.order_items!.filter(row => row.order_id !== orderId)
      for (const row of rows)
        insert('order_items', row)
    },
    findProducts: async uuids => byUuid('products', uuids),
    findVariantProducts: async uuids => new Map(tables.product_variants!.filter(row => uuids.includes(row.uuid)).map(row => [row.uuid as string, row.product_id as number])),
  }
}

/**
 * Reads through to `inner`, writes nothing. What `--dry-run` uses, so its
 * report says "create" or "update" exactly as a real run would.
 */
export function createReadOnlyAccountRepository(inner: AccountRepository): AccountRepository {
  let nextId = -1
  const fake = async () => nextId--
  // Customers a dry run "created" stay visible to the rest of the run, so a
  // customer import followed by an order import reports each shopper once.
  const pretend: ExistingCustomer[] = []

  return {
    async findCustomers(query) {
      const found = await inner.findCustomers(query)
      const extra = pretend.filter(row => (row.uuid !== null && query.uuids.includes(row.uuid)) || query.emails.includes(row.email))
      return [...found, ...extra]
    },
    findOrders: inner.findOrders,
    findProducts: inner.findProducts,
    findVariantProducts: inner.findVariantProducts,
    async createCustomer(row) {
      const id = nextId--
      pretend.push({ id, uuid: row.uuid ?? null, email: String(row.email ?? '').toLowerCase() })
      return id
    },
    createOrder: fake,
    updateCustomer: async () => {},
    updateOrder: async () => {},
    replaceOrderItems: async () => {},
  }
}
