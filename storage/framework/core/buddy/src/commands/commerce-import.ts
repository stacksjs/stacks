import type { catalogImport } from '@stacksjs/commerce'
import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy commerce:import <store-url> --from shopify|woocommerce`
 *
 * Moves a store's CATALOG into the built-in commerce tables: products,
 * variants, categories, brands and image URLs (stacksjs/stacks#1319, #1320).
 * It reads only each platform's public storefront API, so it needs no
 * credentials, and for the same reason it cannot see customers or orders.
 * Those need the platform's admin API and are not imported.
 *
 * Re-running is safe: rows are matched on a UUID derived from the source
 * product id, so a second run updates what the first one wrote.
 */

type ImportResult = catalogImport.ImportResult
type ImportedProduct = catalogImport.ImportedProduct

export const SUPPORTED_SOURCES = ['shopify', 'woocommerce'] as const

export interface CommerceImportFlags {
  from?: string
  limit?: string | number
  currency?: string
  dryRun?: boolean
}

export interface CommerceImportSettings {
  source: typeof SUPPORTED_SOURCES[number]
  limit?: number
  currency?: string
  dryRun: boolean
}

/** Validate the flags, or throw with the message the operator should see. */
export function parseImportFlags(flags: CommerceImportFlags): CommerceImportSettings {
  const source = String(flags.from ?? '').trim().toLowerCase()
  if (!source)
    throw new Error(`Say where the catalog comes from: --from ${SUPPORTED_SOURCES.join(' or --from ')}.`)
  if (!(SUPPORTED_SOURCES as readonly string[]).includes(source))
    throw new Error(`--from must be one of ${SUPPORTED_SOURCES.join(', ')}; got "${flags.from}".`)

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

  return { source: source as CommerceImportSettings['source'], limit, currency, dryRun: flags.dryRun === true }
}

function money(minor: number | null, currency: string | null, format: (minor: number, currency: string | null) => string): string {
  return minor === null ? 'unpriced' : format(minor, currency)
}

/** One line per product, as the import runs. */
export function formatImportedProduct(product: ImportedProduct, format: (minor: number, currency: string | null) => string, dryRun = false): string {
  const verb = product.action === 'create'
    ? (dryRun ? 'would create' : 'created')
    : (dryRun ? 'would update' : 'updated')
  const variantCount = product.variants.create + product.variants.update
  const details = [
    money(product.priceMinor, product.currency, format),
    variantCount > 0 ? `${variantCount} variant${variantCount === 1 ? '' : 's'}` : null,
    product.category ? `in ${product.category}` : null,
    product.vendor ? `by ${product.vendor}` : null,
    product.imageCount === 0 ? 'no image' : null,
  ].filter(Boolean).join(', ')

  return `  ${verb.padEnd(12)} ${product.name} (${product.handle})  ${details}`
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

/** Why the operator should look twice at the currency, or null if it is fine. */
export function currencyMismatch(result: ImportResult, configured: string | undefined): string | null {
  if (!configured || result.currencies.length === 0)
    return null
  const other = result.currencies.filter(code => code !== configured.toUpperCase())
  if (other.length === 0)
    return null
  return `Prices were imported in ${other.join(', ')} minor units, but config/commerce.ts sets currency to ${configured}. products.price has no currency column, so set commerce.currency to match.`
}

export const OUT_OF_SCOPE_NOTE = 'Catalog only. Customers and orders are not imported: they need the Shopify Admin API or WooCommerce REST API keys.'

async function fail(message: string): Promise<never> {
  await log.error(message)
  await log.flush()
  process.exit(ExitCode.FatalError)
}

export function commerceImport(buddy: CLI): void {
  buddy
    .command('commerce:import <url>', 'Import a Shopify or WooCommerce catalog (products, variants, categories, brands, image URLs)')
    .option('--from <platform>', `Where the catalog comes from: ${SUPPORTED_SOURCES.join(' or ')}`)
    .option('--limit <count>', 'Import at most this many products')
    .option('--currency <code>', 'ISO 4217 currency, for a Shopify store whose /meta.json does not report one')
    .option('--dry-run', 'Show what would be created or updated without writing anything', { default: false })
    .example('buddy commerce:import https://shop.example.com --from shopify --dry-run')
    .example('buddy commerce:import example.com/shop --from woocommerce --limit 50')
    .action(async (url: string, options: CommerceImportFlags) => {
      let settings: CommerceImportSettings
      try {
        settings = parseImportFlags(options)
      }
      catch (error) {
        return fail((error as Error).message)
      }

      const { catalogImport } = await import('@stacksjs/commerce')
      const adapter = catalogImport.catalogAdapter(settings.source)!

      let storeUrl: string
      try {
        storeUrl = catalogImport.normalizeStoreUrl(url)
      }
      catch (error) {
        return fail((error as Error).message)
      }

      let repository = catalogImport.createDatabaseRepository()
      if (settings.dryRun) {
        try {
          await repository.findProducts(['00000000-0000-0000-0000-000000000000'])
          repository = catalogImport.createReadOnlyRepository(repository)
        }
        catch (error) {
          log.warn(`No database to compare against (${(error as Error).message}). Every product is reported as new.`)
          repository = catalogImport.createMemoryRepository()
        }
      }

      log.info(`${settings.dryRun ? 'Dry run: reading' : 'Importing'} the ${settings.source} catalog at ${storeUrl}`)

      let result: ImportResult
      try {
        result = await catalogImport.importCatalog({
          adapter,
          storeUrl,
          repository,
          dryRun: settings.dryRun,
          limit: settings.limit,
          currency: settings.currency,
          onProduct: product => process.stdout.write(`${formatImportedProduct(product, catalogImport.formatMinor, settings.dryRun)}\n`),
        })
      }
      catch (error) {
        return fail(`Import stopped: ${(error as Error).message}${settings.dryRun ? '' : ' Products written before this point are kept; re-running resumes safely.'}`)
      }

      if (result.products.length === 0)
        log.info(`${storeUrl} has no products to import.`)

      for (const warning of result.warnings)
        log.warn(warning.externalId ? `${warning.externalId}: ${warning.message}` : warning.message)

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

      log.info(OUT_OF_SCOPE_NOTE)
      if (settings.dryRun)
        log.info('Dry run complete. Nothing was written.')
      else
        log.success(`Imported ${result.products.length} product${result.products.length === 1 ? '' : 's'} from ${storeUrl}`)

      await log.flush()
      process.exit(ExitCode.Success)
    })
}
