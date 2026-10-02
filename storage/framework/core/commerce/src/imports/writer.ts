import type { CatalogAdapter, CatalogFetchOptions, CatalogProduct, CatalogVariant, CatalogWarning } from './types'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database/runtime'
import { formatDate } from '@stacksjs/orm'
import { normalizeStoreUrl, storeHost } from './http'
import { catalogUuid } from './identity'

/**
 * Writing a normalized catalog into the built-in commerce tables.
 *
 * Where each field lands, given the columns those tables actually have:
 *
 * | Source                      | Column                                         |
 * |-----------------------------|------------------------------------------------|
 * | product id + store host     | `products.uuid` (UUIDv5, see `identity.ts`)    |
 * | title / name                | `products.name`                                |
 * | description (HTML)          | `products.description`, unchanged              |
 * | lowest variant price        | `products.price`, integer minor units          |
 * | first image URL             | `products.image_url` (never downloaded)        |
 * | any variant available       | `products.is_available`                        |
 * | summed stock, when exposed  | `products.inventory_count`                     |
 * | first product type/category | `categories` by slug, then `category_id`       |
 * | vendor / brand              | `manufacturers` by name, then `manufacturer_id` |
 * | each real option variant    | `product_variants` (uuid from the variant id)  |
 * | variant SKU                 | `product_variants.sku`, unique per product     |
 * | variant price / compare-at  | `product_variants.price` / `compare_at_price`  |
 * | variant stock, when exposed | `product_variants.inventory_count`             |
 *
 * Variant money is integer minor units, like `products.price`. A NULL variant
 * `price` means "inherits the product price"; a NULL `inventory_count` means
 * stock is not tracked. `options` holds the option values as the JSON string
 * array the dashboard reads. A variant's `description` is never written: the
 * source has no per-variant description, so the column is the merchant's.
 *
 * Re-running updates the rows a previous run wrote (matched on `uuid`) and
 * leaves alone the columns an operator owns: `preparation_time`, `allergens`,
 * `nutritional_info`, a variant's `description`, and a product's or variant's
 * `inventory_count` or a variant's `sku` when the source does not report one.
 *
 * The source wins a SKU. Before a product's variants are updated, the SKUs it
 * is about to write are released from whichever of that product's variants
 * holds them (see `releaseVariantSkus`), so a SKU that moved between variants
 * at the source, or still sits on a variant the source has since deleted,
 * cannot trip the per-product unique index halfway through the product.
 */

export interface ProductRow {
  uuid: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  inventory_count?: number
  preparation_time?: number
  category_id?: number | null
  manufacturer_id?: number | null
  created_at?: string
  updated_at: string
}

export interface VariantRow {
  uuid: string
  product_id: number
  variant: string
  type: string
  options: string
  status: 'active' | 'inactive'
  /** Omitted on update when the source reports none, so a merchant's SKU stays. */
  sku?: string | null
  /** Integer minor units; null inherits `products.price`. */
  price: number | null
  /** Integer minor units; null when the variant is not on sale. */
  compare_at_price: number | null
  /** Null means untracked. Omitted on update when the source reports none. */
  inventory_count?: number | null
  created_at?: string
  updated_at: string
}

export interface CategoryRow {
  uuid: string
  name: string
  slug: string
  description: null
  image_url: null
  is_active: boolean
  parent_category_id: null
  display_order: number
  created_at: string
  updated_at: string
}

export interface ManufacturerRow {
  uuid: string
  manufacturer: string
  description: null
  country: string
  featured: boolean
  created_at: string
  updated_at: string
}

/**
 * Where the importer reads and writes. The database implementation is below;
 * tests and `--dry-run` use the in-memory and read-only ones.
 */
export interface CatalogRepository {
  findCategory: (slug: string, name: string) => Promise<number | undefined>
  createCategory: (row: CategoryRow) => Promise<number>
  findManufacturer: (name: string) => Promise<number | undefined>
  createManufacturer: (row: ManufacturerRow) => Promise<number>
  /** Ids of the products that exist among `uuids`, in one lookup per page. */
  findProducts: (uuids: string[]) => Promise<Map<string, number>>
  createProduct: (row: ProductRow) => Promise<number>
  updateProduct: (id: number, row: Omit<ProductRow, 'uuid'>) => Promise<void>
  /** Ids of the variants that exist among `uuids`, in one lookup per product. */
  findVariants: (uuids: string[]) => Promise<Map<string, number>>
  createVariant: (row: VariantRow) => Promise<number>
  updateVariant: (id: number, row: Omit<VariantRow, 'uuid'>) => Promise<void>
  /**
   * Clear `sku` on whichever of `productId`'s variants hold one of `skus`, so
   * the variants about to claim them cannot collide with the per-product
   * unique index, whatever order they are written in.
   */
  releaseVariantSkus: (productId: number, skus: string[]) => Promise<void>
  /** Run `work` atomically, so a product never lands without its variants. */
  transaction?: <T>(work: (repository: CatalogRepository) => Promise<T>) => Promise<T>
}

/** Manufacturers require a country; the source never says which. */
export const UNKNOWN_COUNTRY = 'Unknown'

/** `preparation_time` is a restaurant field the dashboard requires to be >= 1. */
const DEFAULT_PREPARATION_TIME = 1

const TYPE_MAX = 50

/** `product_variants.sku` is a 100-character column (see the model). */
export const SKU_MAX = 100

/** The lowest price among a product's priced variants. */
export function lowestPrice(variants: CatalogVariant[]): number | null {
  const prices = variants.map(variant => variant.priceMinor).filter((price): price is number => price !== null)
  return prices.length > 0 ? Math.min(...prices) : null
}

/** Total stock, or null unless every variant reports its count. */
export function totalInventory(variants: CatalogVariant[]): number | null {
  if (variants.length === 0 || variants.some(variant => variant.inventory === null))
    return null
  return variants.reduce((sum, variant) => sum + (variant.inventory ?? 0), 0)
}

/**
 * The SKU each of a product's variants may write, keyed by variant id.
 *
 * `product_variants.sku` is unique per product, but no source enforces that:
 * Shopify accepts the same SKU on every variant. The first variant to carry a
 * SKU keeps it; a later duplicate, or a SKU too long for the column, is
 * written as no SKU and reported, rather than failing the whole product.
 */
export function variantSkus(product: CatalogProduct): { skus: Map<string, string | null>, warnings: CatalogWarning[] } {
  const skus = new Map<string, string | null>()
  const warnings: CatalogWarning[] = []
  const claimed = new Set<string>()

  for (const variant of product.variants) {
    const sku = variant.sku
    if (sku === null) {
      skus.set(variant.externalId, null)
    }
    else if (sku.length > SKU_MAX) {
      skus.set(variant.externalId, null)
      warnings.push({ externalId: product.externalId, message: `"${product.name}" variant "${variant.title}" has a SKU longer than ${SKU_MAX} characters; imported without it` })
    }
    else if (claimed.has(sku)) {
      skus.set(variant.externalId, null)
      warnings.push({ externalId: product.externalId, message: `"${product.name}" variant "${variant.title}" repeats SKU ${sku}; imported without it` })
    }
    else {
      claimed.add(sku)
      skus.set(variant.externalId, sku)
    }
  }

  return { skus, warnings }
}

export interface ProductRefs {
  categoryId: number | null
  manufacturerId: number | null
}

/** The `products` row for a catalog product. Pure. */
export function productRow(product: CatalogProduct, host: string, refs: ProductRefs, now: string, mode: 'create' | 'update'): ProductRow {
  const inventory = totalInventory(product.variants)
  const row: ProductRow = {
    uuid: catalogUuid(product.source, host, 'product', product.externalId),
    name: product.name,
    description: product.descriptionHtml,
    price: lowestPrice(product.variants) ?? 0,
    image_url: product.images[0]?.src ?? null,
    is_available: product.variants.some(variant => variant.available),
    updated_at: now,
  }

  if (mode === 'create') {
    row.inventory_count = inventory ?? 0
    row.preparation_time = DEFAULT_PREPARATION_TIME
    row.category_id = refs.categoryId
    row.manufacturer_id = refs.manufacturerId
    row.created_at = now
  }
  else {
    // Only overwrite what the source actually told us.
    if (inventory !== null)
      row.inventory_count = inventory
    if (refs.categoryId !== null)
      row.category_id = refs.categoryId
    if (refs.manufacturerId !== null)
      row.manufacturer_id = refs.manufacturerId
  }

  return row
}

/**
 * The `product_variants` row for one variant of a catalog product. Pure.
 *
 * `sku` is the SKU this variant may claim (see `variantSkus`), which can be
 * null even when the source reported one.
 */
export function variantRow(product: CatalogProduct, variant: CatalogVariant, host: string, productId: number, now: string, mode: 'create' | 'update', sku: string | null = variant.sku): VariantRow {
  const row: VariantRow = {
    uuid: catalogUuid(product.source, host, 'variant', variant.externalId),
    product_id: productId,
    variant: variant.title,
    type: (product.optionNames.join(' / ') || 'Option').slice(0, TYPE_MAX),
    options: JSON.stringify(variant.optionValues),
    status: variant.available ? 'active' : 'inactive',
    // The source owns pricing, so both are written on every run. A null
    // compare-at is information too: the variant is no longer on sale.
    price: variant.priceMinor,
    compare_at_price: variant.compareAtMinor,
    updated_at: now,
  }

  if (mode === 'create') {
    row.sku = sku
    row.inventory_count = variant.inventory
    row.created_at = now
  }
  else {
    // Only overwrite what the source actually told us.
    if (sku !== null)
      row.sku = sku
    if (variant.inventory !== null)
      row.inventory_count = variant.inventory
  }

  return row
}

/** A row minus its identity, for an UPDATE that must never rewrite the key. */
function withoutUuid<T extends { uuid: string }>(row: T): Omit<T, 'uuid'> {
  const changes: Partial<T> = { ...row }
  delete changes.uuid
  return changes as Omit<T, 'uuid'>
}

export type ImportAction = 'create' | 'update'

export interface ImportedProduct {
  action: ImportAction
  externalId: string
  name: string
  handle: string
  priceMinor: number | null
  currency: string | null
  variants: { create: number, update: number }
  category: string | null
  vendor: string | null
  imageCount: number
}

export interface ImportCounts {
  created: number
  updated: number
}

export interface ImportResult {
  source: string
  storeUrl: string
  dryRun: boolean
  pages: string[]
  products: ImportedProduct[]
  counts: {
    products: ImportCounts
    variants: ImportCounts
    categories: ImportCounts
    manufacturers: ImportCounts
    duplicates: number
  }
  /** Every currency seen across the catalog. More than one is a warning. */
  currencies: string[]
  warnings: CatalogWarning[]
}

export interface ImportCatalogOptions extends CatalogFetchOptions {
  adapter: CatalogAdapter
  storeUrl: string
  repository: CatalogRepository
  /** Recorded in the result; the repository decides whether anything is written. */
  dryRun?: boolean
  /** Called after each product is written, for progress output. */
  onProduct?: (product: ImportedProduct) => void
  /** Injected clock, for deterministic tests. */
  now?: () => Date
}

/**
 * Fetch a store's catalog through `adapter` and upsert it via `repository`.
 *
 * Idempotent: products and variants are matched on their derived `uuid`,
 * categories on slug (then name) and manufacturers on name, so a second run
 * over an unchanged store creates nothing.
 */
export async function importCatalog(options: ImportCatalogOptions): Promise<ImportResult> {
  const storeUrl = normalizeStoreUrl(options.storeUrl)
  const host = storeHost(storeUrl)
  const clock = options.now ?? (() => new Date())
  const { adapter, repository } = options

  const result: ImportResult = {
    source: adapter.name,
    storeUrl,
    dryRun: options.dryRun === true,
    pages: [],
    products: [],
    counts: {
      products: { created: 0, updated: 0 },
      variants: { created: 0, updated: 0 },
      categories: { created: 0, updated: 0 },
      manufacturers: { created: 0, updated: 0 },
      duplicates: 0,
    },
    currencies: [],
    warnings: [],
  }

  const categoryIds = new Map<string, number>()
  const manufacturerIds = new Map<string, number>()
  const seenProducts = new Map<string, string>()
  const currencies = new Set<string>()

  async function categoryFor(product: CatalogProduct, repo: CatalogRepository, now: string): Promise<number | null> {
    const category = product.categories[0]
    if (!category)
      return null

    const cached = categoryIds.get(category.slug)
    if (cached !== undefined)
      return cached

    let id = await repo.findCategory(category.slug, category.name)
    if (id === undefined) {
      id = await repo.createCategory({
        uuid: randomUUIDv7(),
        name: category.name,
        slug: category.slug,
        description: null,
        image_url: null,
        is_active: true,
        parent_category_id: null,
        display_order: categoryIds.size,
        created_at: now,
        updated_at: now,
      })
      result.counts.categories.created++
    }

    categoryIds.set(category.slug, id)
    return id
  }

  async function manufacturerFor(product: CatalogProduct, repo: CatalogRepository, now: string): Promise<number | null> {
    if (!product.vendor)
      return null

    const cached = manufacturerIds.get(product.vendor)
    if (cached !== undefined)
      return cached

    let id = await repo.findManufacturer(product.vendor)
    if (id === undefined) {
      id = await repo.createManufacturer({
        uuid: randomUUIDv7(),
        manufacturer: product.vendor,
        description: null,
        country: UNKNOWN_COUNTRY,
        featured: false,
        created_at: now,
        updated_at: now,
      })
      result.counts.manufacturers.created++
    }

    manufacturerIds.set(product.vendor, id)
    return id
  }

  /**
   * Which of a page's products and variants already exist, looked up once per
   * page rather than once per row: a 250-product page is two queries, not 500.
   */
  async function existingFor(products: CatalogProduct[]): Promise<{ products: Map<string, number>, variants: Map<string, number> }> {
    const productUuids = products.map(product => catalogUuid(product.source, host, 'product', product.externalId))
    const variantUuids = products
      .filter(product => product.hasOptions)
      .flatMap(product => product.variants.map(variant => catalogUuid(product.source, host, 'variant', variant.externalId)))

    return {
      products: productUuids.length > 0 ? await repository.findProducts(productUuids) : new Map(),
      variants: variantUuids.length > 0 ? await repository.findVariants(variantUuids) : new Map(),
    }
  }

  async function write(product: CatalogProduct, repo: CatalogRepository, known: { products: Map<string, number>, variants: Map<string, number> }): Promise<ImportedProduct> {
    const now = formatDate(clock())
    const refs = {
      categoryId: await categoryFor(product, repo, now),
      manufacturerId: await manufacturerFor(product, repo, now),
    }

    const uuid = catalogUuid(product.source, host, 'product', product.externalId)
    const existing = known.products.get(uuid)
    const action: ImportAction = existing === undefined ? 'create' : 'update'

    let productId: number
    if (existing === undefined) {
      productId = await repo.createProduct(productRow(product, host, refs, now, 'create'))
    }
    else {
      productId = existing
      await repo.updateProduct(productId, withoutUuid(productRow(product, host, refs, now, 'update')))
    }

    const variants = { create: 0, update: 0 }
    if (product.hasOptions) {
      const { skus, warnings } = variantSkus(product)
      result.warnings.push(...warnings)

      // A product created just now has no variants to collide with.
      const claimed = [...skus.values()].filter((sku): sku is string => sku !== null)
      if (existing !== undefined && claimed.length > 0)
        await repo.releaseVariantSkus(productId, claimed)

      for (const variant of product.variants) {
        const sku = skus.get(variant.externalId) ?? null
        const found = known.variants.get(catalogUuid(product.source, host, 'variant', variant.externalId))
        if (found === undefined) {
          await repo.createVariant(variantRow(product, variant, host, productId, now, 'create', sku))
          variants.create++
        }
        else {
          await repo.updateVariant(found, withoutUuid(variantRow(product, variant, host, productId, now, 'update', sku)))
          variants.update++
        }
      }
    }

    return {
      action,
      externalId: product.externalId,
      name: product.name,
      handle: product.handle,
      priceMinor: lowestPrice(product.variants),
      currency: product.currency,
      variants,
      category: product.categories[0]?.name ?? null,
      vendor: product.vendor,
      imageCount: product.images.length,
    }
  }

  for await (const page of adapter.pages(storeUrl, { limit: options.limit, fetch: options.fetch, currency: options.currency, accessKey: options.accessKey })) {
    result.pages.push(page.url)
    result.warnings.push(...page.warnings)

    const fresh: CatalogProduct[] = []
    for (const product of page.products) {
      const firstHandle = seenProducts.get(product.externalId)
      if (firstHandle !== undefined) {
        // A catalog that changes mid-import can shift a product onto the next
        // page as well. Writing it twice is harmless; counting it twice is not.
        result.counts.duplicates++
        result.warnings.push({ externalId: product.externalId, message: `"${product.name}" appeared twice; imported once` })
        continue
      }
      seenProducts.set(product.externalId, product.handle)
      fresh.push(product)
    }

    const known = await existingFor(fresh)

    for (const product of fresh) {
      if (product.currency)
        currencies.add(product.currency)

      const imported = repository.transaction
        ? await repository.transaction(repo => write(product, repo, known))
        : await write(product, repository, known)

      result.counts.products[imported.action === 'create' ? 'created' : 'updated']++
      result.counts.variants.created += imported.variants.create
      result.counts.variants.updated += imported.variants.update
      result.products.push(imported)
      options.onProduct?.(imported)
    }
  }

  result.currencies = [...currencies].sort()
  if (result.currencies.length > 1)
    result.warnings.push({ message: `prices arrived in more than one currency (${result.currencies.join(', ')}); products.price has no currency column` })

  return result
}

/**
 * A repository over the commerce tables, via the query builder.
 *
 * Inserts are read back by `uuid`, which works on every dialect: Postgres
 * reports no insert id without `RETURNING`, and a row count is never an id.
 */
export function createDatabaseRepository(connection: any = db): CatalogRepository {
  async function idByUuid(table: string, uuid: string): Promise<number> {
    const row = await connection.selectFrom(table).where('uuid', '=', uuid).select('id').executeTakeFirst()
    if (!row)
      throw new Error(`Inserted a row into ${table} but could not read it back (uuid ${uuid})`)
    return Number(row.id)
  }

  /** `uuid -> id` for the rows that exist, chunked to stay under bind limits. */
  async function idsByUuid(table: string, uuids: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>()
    for (let start = 0; start < uuids.length; start += 500) {
      const rows = await connection.selectFrom(table).where('uuid', 'in', uuids.slice(start, start + 500)).select(['id', 'uuid']).execute()
      for (const row of rows as Array<{ id: unknown, uuid: string }>)
        found.set(row.uuid, Number(row.id))
    }
    return found
  }

  async function first(query: any): Promise<number | undefined> {
    const row = await query.select('id').executeTakeFirst()
    return row ? Number(row.id) : undefined
  }

  const repository: CatalogRepository = {
    async findCategory(slug, name) {
      return await first(connection.selectFrom('categories').where('slug', '=', slug))
        ?? await first(connection.selectFrom('categories').where('name', '=', name))
    },
    async createCategory(row) {
      await connection.insertInto('categories').values(row).execute()
      return idByUuid('categories', row.uuid)
    },
    async findManufacturer(name) {
      return first(connection.selectFrom('manufacturers').where('manufacturer', '=', name))
    },
    async createManufacturer(row) {
      await connection.insertInto('manufacturers').values(row).execute()
      return idByUuid('manufacturers', row.uuid)
    },
    async findProducts(uuids) {
      return idsByUuid('products', uuids)
    },
    async createProduct(row) {
      await connection.insertInto('products').values(row).execute()
      return idByUuid('products', row.uuid)
    },
    async updateProduct(id, row) {
      await connection.updateTable('products').set(row).where('id', '=', id).execute()
    },
    async findVariants(uuids) {
      return idsByUuid('product_variants', uuids)
    },
    async createVariant(row) {
      await connection.insertInto('product_variants').values(row).execute()
      return idByUuid('product_variants', row.uuid)
    },
    async updateVariant(id, row) {
      await connection.updateTable('product_variants').set(row).where('id', '=', id).execute()
    },
    async releaseVariantSkus(productId, skus) {
      for (let start = 0; start < skus.length; start += 500) {
        await connection.updateTable('product_variants')
          .set({ sku: null })
          .where('product_id', '=', productId)
          .where('sku', 'in', skus.slice(start, start + 500))
          .execute()
      }
    },
  }

  if (connection === db) {
    repository.transaction = work => db.transaction((trx: any) => work(createDatabaseRepository(trx)))
  }

  return repository
}

/**
 * A repository that keeps rows in memory. Backs the importer's own tests and
 * a `--dry-run` with no database to compare against.
 */
export function createMemoryRepository(): CatalogRepository & { tables: Record<string, Array<Record<string, any>>> } {
  const tables: Record<string, Array<Record<string, any>>> = {
    categories: [],
    manufacturers: [],
    products: [],
    product_variants: [],
  }

  function insert(table: string, row: object): number {
    const id = tables[table]!.length + 1
    tables[table]!.push({ id, ...row })
    return id
  }

  function update(table: string, id: number, row: object): void {
    const target = tables[table]!.find(entry => entry.id === id)
    if (target)
      Object.assign(target, row)
  }

  const byUuid = (table: string, uuids: string[]) => new Map(tables[table]!.filter(row => uuids.includes(row.uuid)).map(row => [row.uuid as string, row.id as number]))
  const find = (table: string, match: (row: Record<string, any>) => boolean) => tables[table]!.find(match)?.id as number | undefined

  return {
    tables,
    findCategory: async (slug, name) => find('categories', row => row.slug === slug) ?? find('categories', row => row.name === name),
    createCategory: async row => insert('categories', row),
    findManufacturer: async name => find('manufacturers', row => row.manufacturer === name),
    createManufacturer: async row => insert('manufacturers', row),
    findProducts: async uuids => byUuid('products', uuids),
    createProduct: async row => insert('products', row),
    updateProduct: async (id, row) => update('products', id, row),
    findVariants: async uuids => byUuid('product_variants', uuids),
    createVariant: async row => insert('product_variants', row),
    updateVariant: async (id, row) => update('product_variants', id, row),
    releaseVariantSkus: async (productId, skus) => {
      for (const row of tables.product_variants!) {
        if (row.product_id === productId && skus.includes(row.sku))
          row.sku = null
      }
    },
  }
}

/**
 * Reads through to `inner`, writes nothing. What `--dry-run` uses, so its
 * report says "create" or "update" exactly as a real run would.
 */
export function createReadOnlyRepository(inner: CatalogRepository): CatalogRepository {
  let nextId = -1
  const fake = async () => nextId--

  return {
    findCategory: inner.findCategory,
    findManufacturer: inner.findManufacturer,
    findProducts: inner.findProducts,
    findVariants: inner.findVariants,
    createCategory: fake,
    createManufacturer: fake,
    createProduct: fake,
    createVariant: fake,
    updateProduct: async () => {},
    updateVariant: async () => {},
    releaseVariantSkus: async () => {},
  }
}
