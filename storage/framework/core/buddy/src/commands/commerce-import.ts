import type { catalogImport } from '@stacksjs/commerce'
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy commerce:import <store-url> --from shopify|woocommerce|shopware`
 *
 * By default moves a store's CATALOG into the built-in commerce tables:
 * products, variants, categories, brands and image URLs (stacksjs/stacks#1319,
 * #1320, #1321). That reads only each platform's public storefront API, so it
 * needs no credentials (Shopware's Store API asks for the sales channel access
 * key, which is public by design).
 *
 * `--customers` and `--orders` import those too (stacksjs/stacks#2853), from
 * the platform's admin API. That needs credentials, which are read from env
 * only (SHOPIFY_ADMIN_TOKEN, WOOCOMMERCE_CONSUMER_KEY / _SECRET,
 * SHOPWARE_CLIENT_ID / _SECRET) and never from a flag, where they would land
 * in shell history. A missing one fails before the first request.
 *
 * Re-running is safe: rows are matched on a UUID derived from the source id
 * (customers on their email as well), so a second run updates what the first
 * one wrote.
 */

type ImportResult = catalogImport.ImportResult
type ImportedProduct = catalogImport.ImportedProduct
type ImportedCustomer = catalogImport.ImportedCustomer
type ImportedOrder = catalogImport.ImportedOrder
type CustomerImportResult = catalogImport.CustomerImportResult
type OrderImportResult = catalogImport.OrderImportResult
type AccountCredentials = catalogImport.AccountCredentials

export const SUPPORTED_SOURCES = ['shopify', 'woocommerce', 'shopware'] as const

export interface CommerceImportFlags {
  from?: string
  limit?: string | number
  currency?: string
  accessKey?: string
  adminUrl?: string
  catalog?: boolean
  customers?: boolean
  orders?: boolean
  dryRun?: boolean
}

export interface ImportSelection {
  catalog: boolean
  customers: boolean
  orders: boolean
}

export interface CommerceImportSettings {
  source: typeof SUPPORTED_SOURCES[number]
  limit?: number
  currency?: string
  /** Shopware's sales channel access key; set only for a Shopware catalog import. */
  accessKey?: string
  /** Where the admin API lives, when it differs from the store URL (Shopify's .myshopify.com address). */
  adminUrl?: string
  include: ImportSelection
  dryRun: boolean
}

/** The env vars each platform's customer and order import reads, for --help and errors. */
export const CREDENTIAL_ENV: Record<typeof SUPPORTED_SOURCES[number], string> = {
  shopify: 'SHOPIFY_ADMIN_TOKEN',
  woocommerce: 'WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET',
  shopware: 'SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET',
}

/** Where to find a Shopware sales channel access key, for the error that asks for one. */
export const SHOPWARE_ACCESS_KEY_HELP = 'It is public by design, not a secret. Find it in the Shopware Administration under Sales Channels: open the storefront or headless sales channel and copy the key from its "API access" card.'

/**
 * Validate the flags, or throw with the message the operator should see.
 *
 * `env` is read for `SHOPWARE_ACCESS_KEY` only, and only for a Shopware
 * catalog import. Admin API credentials are read by the importer itself
 * (`readAccountCredentials`), before its first request.
 */
export function parseImportFlags(flags: CommerceImportFlags, env: Record<string, string | undefined> = process.env): CommerceImportSettings {
  const source = String(flags.from ?? '').trim().toLowerCase()
  if (!source)
    throw new Error(`Say where the catalog comes from: --from ${SUPPORTED_SOURCES.join(' or --from ')}.`)
  if (!(SUPPORTED_SOURCES as readonly string[]).includes(source))
    throw new Error(`--from must be one of ${SUPPORTED_SOURCES.join(', ')}; got "${flags.from}".`)

  const customers = flags.customers === true
  const orders = flags.orders === true
  // The catalog is the default, and stays in when asked for alongside the rest.
  const include: ImportSelection = { catalog: flags.catalog === true || (!customers && !orders), customers, orders }

  let limit: number | undefined
  if (flags.limit !== undefined && flags.limit !== '') {
    limit = Number(flags.limit)
    if (!Number.isInteger(limit) || limit <= 0)
      throw new Error(`--limit must be a whole number above 0; got "${flags.limit}".`)
  }

  let currency: string | undefined
  if (flags.currency !== undefined && flags.currency !== '') {
    currency = String(flags.currency).trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency))
      throw new Error(`--currency must be a three-letter ISO 4217 code such as USD; got "${flags.currency}".`)
  }

  let adminUrl: string | undefined
  if (flags.adminUrl !== undefined && String(flags.adminUrl).trim() !== '') {
    if (!customers && !orders)
      throw new Error('--admin-url only applies to --customers and --orders; the catalog is read from the storefront.')
    adminUrl = String(flags.adminUrl).trim()
  }

  const flagKey = flags.accessKey === undefined ? '' : String(flags.accessKey).trim()
  let accessKey: string | undefined
  if (source === 'shopware' && include.catalog) {
    accessKey = flagKey || env.SHOPWARE_ACCESS_KEY?.trim() || undefined
    if (!accessKey)
      throw new Error(`Shopware's Store API needs the sales channel access key: pass --access-key <key> or set SHOPWARE_ACCESS_KEY. ${SHOPWARE_ACCESS_KEY_HELP}`)
    if (/\s/.test(accessKey))
      throw new Error('--access-key must be a single key with no spaces.')
    // Shopware prefixes generated keys: SWSC sales channel, SWIA integration, SWUA user.
    if (/^SW(?:IA|UA)/i.test(accessKey))
      throw new Error(`That looks like an Admin API key (it starts with ${accessKey.slice(0, 4).toUpperCase()}), not a sales channel access key (SWSC...). Customers and orders read SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET from env instead. ${SHOPWARE_ACCESS_KEY_HELP}`)
  }
  else if (flagKey && source === 'shopware') {
    throw new Error('--access-key is for the catalog (the Store API). Customers and orders read SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET from env.')
  }
  else if (flagKey) {
    throw new Error(`--access-key only applies to --from shopware; ${source} needs no key.`)
  }

  return {
    source: source as CommerceImportSettings['source'],
    limit,
    currency,
    ...(accessKey ? { accessKey } : {}),
    ...(adminUrl ? { adminUrl } : {}),
    include,
    dryRun: flags.dryRun === true,
  }
}

function money(minor: number | null, currency: string | null, format: (minor: number, currency: string | null) => string): string {
  return minor === null ? 'unpriced' : format(minor, currency)
}

function verbOf(action: 'create' | 'update', dryRun: boolean): string {
  if (action === 'create')
    return dryRun ? 'would create' : 'created'
  return dryRun ? 'would update' : 'updated'
}

/** One line per product, as the import runs. */
export function formatImportedProduct(product: ImportedProduct, format: (minor: number, currency: string | null) => string, dryRun = false): string {
  const variantCount = product.variants.create + product.variants.update
  const details = [
    money(product.priceMinor, product.currency, format),
    variantCount > 0 ? `${variantCount} variant${variantCount === 1 ? '' : 's'}` : null,
    product.category ? `in ${product.category}` : null,
    product.vendor ? `by ${product.vendor}` : null,
    product.imageCount === 0 ? 'no image' : null,
  ].filter(Boolean).join(', ')

  return `  ${verbOf(product.action, dryRun).padEnd(12)} ${product.name} (${product.handle})  ${details}`
}

/** One line per customer, as the import runs. */
export function formatImportedCustomer(customer: ImportedCustomer, dryRun = false): string {
  const matched = customer.matchedBy === 'email' ? '  (matched an existing customer by email)' : ''
  return `  ${verbOf(customer.action, dryRun).padEnd(12)} ${customer.name} <${customer.email}>${matched}`
}

/** One line per order, as the import runs. */
export function formatImportedOrder(order: ImportedOrder, format: (minor: number, currency: string | null) => string, dryRun = false): string {
  const details = [
    format(order.totalMinor, order.currency),
    `${order.status} (${order.sourceStatus})`,
    `${order.lines} line${order.lines === 1 ? '' : 's'}`,
    order.unlinkedLines > 0 ? `${order.unlinkedLines} without a product` : null,
    order.customerEmail ? `for ${order.customerEmail}` : 'no customer',
  ].filter(Boolean).join(', ')
  return `  ${verbOf(order.action, dryRun).padEnd(12)} ${order.number ?? order.externalId}  ${details}`
}

/** The closing summary, one fact per line. */
export function formatImportSummary(result: ImportResult): string[] {
  const { counts } = result
  const would = result.dryRun ? 'would be ' : ''
  return [
    `Products: ${counts.products.created} ${would}created, ${counts.products.updated} ${would}updated`,
    `Variants: ${counts.variants.created} ${would}created, ${counts.variants.updated} ${would}updated`,
    `Categories: ${counts.categories.created} ${would}created. Manufacturers: ${counts.manufacturers.created} ${would}created`,
    ...(counts.duplicates > 0 ? [`Duplicates skipped: ${counts.duplicates}`] : []),
    `Currency: ${result.currencies.length > 0 ? result.currencies.join(', ') : 'not reported by the store'}`,
  ]
}

/** The closing summary of a customer import. */
export function formatCustomerSummary(result: CustomerImportResult): string[] {
  const would = result.dryRun ? 'would be ' : ''
  const { customers, merged } = result.counts
  return [
    `Customers: ${customers.created} ${would}created, ${customers.updated} ${would}updated${merged > 0 ? `, ${merged} merged by email` : ''}`,
  ]
}

/** The closing summary of an order import. */
export function formatOrderSummary(result: OrderImportResult): string[] {
  const would = result.dryRun ? 'would be ' : ''
  const { orders, customers, lines, duplicates } = result.counts
  return [
    `Orders: ${orders.created} ${would}created, ${orders.updated} ${would}updated${duplicates > 0 ? `, ${duplicates} duplicates skipped` : ''}`,
    `Order lines: ${lines.linked} linked to a product, ${lines.unlinked} without one`,
    ...(customers.created > 0 ? [`Customers created from orders: ${customers.created}`] : []),
    `Order currencies: ${result.currencies.length > 0 ? result.currencies.join(', ') : 'none'}`,
  ]
}

/** Why the operator should look twice at the currency, or null if it is fine. */
export function currencyMismatch(result: ImportResult, configured: string | undefined): string | null {
  if (!configured || result.currencies.length === 0)
    return null
  const other = result.currencies.filter(code => code !== configured.toUpperCase())
  if (other.length === 0)
    return null
  return `Prices were imported in ${other.join(', ')} minor units, but config/commerce.ts sets currency to ${configured}. products.price has no currency column, so set commerce.currency to match.`
}

export const OUT_OF_SCOPE_NOTE = 'Customers and orders were not imported. Add --customers and/or --orders, with the admin API credentials in env: SHOPIFY_ADMIN_TOKEN, WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET, or SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET.'

async function fail(message: string): Promise<never> {
  await log.error(message)
  await log.flush()
  process.exit(ExitCode.FatalError)
}

function reportWarnings(warnings: Array<{ externalId?: string, message: string }>): void {
  for (const warning of warnings)
    log.warn(warning.externalId ? `${warning.externalId}: ${warning.message}` : warning.message)
}

export function commerceImport(buddy: CLI): void {
  buddy
    .command('commerce:import <url>', 'Import a Shopify, WooCommerce or Shopware 6 catalog, and optionally its customers and orders')
    .option('--from <platform>', `Where the store lives: ${SUPPORTED_SOURCES.join(', ')}`)
    .option('--customers', 'Also import customers from the admin API (credentials from env: SHOPIFY_ADMIN_TOKEN, WOOCOMMERCE_CONSUMER_KEY/_SECRET or SHOPWARE_CLIENT_ID/_SECRET)', { default: false })
    .option('--orders', 'Also import orders and their lines from the admin API (same credentials as --customers)', { default: false })
    .option('--catalog', 'Import the catalog too when --customers or --orders is given (it is the default otherwise)', { default: false })
    .option('--access-key <key>', 'Shopware catalog only: the sales channel access key (public, from Sales Channels > API access), or set SHOPWARE_ACCESS_KEY')
    .option('--admin-url <url>', 'Customers and orders only: the admin API address when it differs from <url>, e.g. https://<store>.myshopify.com for a Shopify custom domain')
    .option('--limit <count>', 'Import at most this many products, customers and orders (each)')
    .option('--currency <code>', 'ISO 4217 currency, for a store or order that does not report one')
    .option('--dry-run', 'Show what would be created or updated without writing anything', { default: false })
    .example('buddy commerce:import https://shop.example.com --from shopify --dry-run')
    .example('buddy commerce:import example.com/shop --from woocommerce --limit 50')
    .example('buddy commerce:import https://shop.example.de --from shopware --access-key SWSC... --dry-run')
    .example('SHOPIFY_ADMIN_TOKEN=shpat_... buddy commerce:import https://shop.example.com --from shopify --customers --orders --admin-url northwind.myshopify.com')
    .action(async (url: string, options: CommerceImportFlags) => {
      let settings: CommerceImportSettings
      try {
        settings = parseImportFlags(options)
      }
      catch (error) {
        return fail((error as Error).message)
      }

      const { catalogImport } = await import('@stacksjs/commerce')
      const formatMinor = catalogImport.formatMinor
      const { include, dryRun } = settings
      const accounts = include.customers || include.orders

      let storeUrl: string
      let credentials: AccountCredentials | undefined
      try {
        storeUrl = catalogImport.normalizeStoreUrl(url)
        // Before any request: a missing credential names its env vars now,
        // not as a 401 after the catalog has been imported.
        if (accounts)
          credentials = catalogImport.readAccountCredentials(settings.source, process.env)
      }
      catch (error) {
        return fail((error as Error).message)
      }

      if (include.catalog) {
        let repository = catalogImport.createDatabaseRepository()
        if (dryRun) {
          try {
            await repository.findProducts(['00000000-0000-0000-0000-000000000000'])
            repository = catalogImport.createReadOnlyRepository(repository)
          }
          catch (error) {
            log.warn(`No database to compare against (${(error as Error).message}). Every product is reported as new.`)
            repository = catalogImport.createMemoryRepository()
          }
        }

        log.info(`${dryRun ? 'Dry run: reading' : 'Importing'} the ${settings.source} catalog at ${storeUrl}`)

        let result: ImportResult
        try {
          result = await catalogImport.importCatalog({
            adapter: catalogImport.catalogAdapter(settings.source)!,
            storeUrl,
            repository,
            dryRun,
            limit: settings.limit,
            currency: settings.currency,
            accessKey: settings.accessKey,
            onProduct: product => process.stdout.write(`${formatImportedProduct(product, formatMinor, dryRun)}\n`),
          })
        }
        catch (error) {
          return fail(`Import stopped: ${(error as Error).message}${dryRun ? '' : ' Products written before this point are kept; re-running resumes safely.'}`)
        }

        if (result.products.length === 0)
          log.info(`${storeUrl} has no products to import.`)
        reportWarnings(result.warnings)
        for (const line of formatImportSummary(result))
          log.info(line)

        try {
          const { config } = await import('@stacksjs/config')
          const mismatch = currencyMismatch(result, (config as { commerce?: { currency?: string } }).commerce?.currency)
          if (mismatch)
            log.warn(mismatch)
        }
        catch {
          // No readable config is no reason to fail an import that finished.
        }
      }

      if (accounts) {
        let repository = catalogImport.createDatabaseAccountRepository()
        if (dryRun) {
          try {
            await repository.findOrders(['00000000-0000-0000-0000-000000000000'])
            repository = catalogImport.createReadOnlyAccountRepository(repository)
          }
          catch (error) {
            log.warn(`No database to compare against (${(error as Error).message}). Every customer and order is reported as new.`)
            repository = catalogImport.createReadOnlyAccountRepository(catalogImport.createMemoryAccountRepository())
          }
          if (include.catalog && include.orders)
            log.info('A dry run writes no products, so order lines are matched only against products already in Stacks.')
        }

        const adapter = catalogImport.accountAdapter(settings.source)!
        const shared = {
          adapter,
          storeUrl,
          repository,
          credentials: credentials!,
          dryRun,
          limit: settings.limit,
          currency: settings.currency,
          adminUrl: settings.adminUrl,
        }

        if (include.customers) {
          log.info(`${dryRun ? 'Dry run: reading' : 'Importing'} ${settings.source} customers from ${settings.adminUrl ?? storeUrl}`)
          try {
            const result = await catalogImport.importCustomers({
              ...shared,
              onCustomer: customer => process.stdout.write(`${formatImportedCustomer(customer, dryRun)}\n`),
            })
            reportWarnings(result.warnings)
            for (const line of formatCustomerSummary(result))
              log.info(line)
          }
          catch (error) {
            return fail(`Customer import stopped: ${(error as Error).message}${dryRun ? '' : ' Customers written before this point are kept; re-running resumes safely.'}`)
          }
        }

        if (include.orders) {
          log.info(`${dryRun ? 'Dry run: reading' : 'Importing'} ${settings.source} orders from ${settings.adminUrl ?? storeUrl}`)
          try {
            const result = await catalogImport.importOrders({
              ...shared,
              onOrder: order => process.stdout.write(`${formatImportedOrder(order, formatMinor, dryRun)}\n`),
            })
            reportWarnings(result.warnings)
            for (const line of formatOrderSummary(result))
              log.info(line)
          }
          catch (error) {
            return fail(`Order import stopped: ${(error as Error).message}${dryRun ? '' : ' Orders written before this point are kept; re-running resumes safely.'}`)
          }
        }
      }
      else {
        log.info(OUT_OF_SCOPE_NOTE)
      }

      if (dryRun)
        log.info('Dry run complete. Nothing was written.')
      else
        log.success(`Import from ${storeUrl} complete.`)

      await log.flush()
      process.exit(ExitCode.Success)
    })
}
