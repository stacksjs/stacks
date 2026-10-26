import type { ModelRow, NewModelData, Product } from '@stacksjs/orm'
type ProductJsonResponse = ModelRow<typeof Product>
type NewProduct = NewModelData<typeof Product>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database/runtime'
import { uniqueSlug } from '@stacksjs/slug'
import { insertedId } from '../../utils/inserted-id'
import { fetchById, getProductByUuid } from './fetch'

/**
 * The slug a product is stored under: the caller's, or one made from its name
 * that no other product has. The storefront looks products up by it
 * (stacksjs/stacks#3005). `connection` and `claimed` let a batch see its own
 * rows before they are committed.
 */
async function productSlug(
  data: NewProduct,
  connection?: NonNullable<Parameters<typeof uniqueSlug>[1]>['connection'],
  claimed?: Set<string>,
): Promise<string> {
  const chosen = (data as { slug?: unknown }).slug
  if (typeof chosen === 'string' && chosen.trim()) {
    claimed?.add(chosen.trim())
    return chosen.trim()
  }
  return uniqueSlug(String(data.name ?? ''), { table: 'products', column: 'slug', connection, claimed })
}

/**
 * Create a new product item
 *
 * @param data The product item data to store
 * @returns The newly created product item record
 */
export async function store(data: NewProduct): Promise<ProductJsonResponse> {
  try {
    const itemData = {
      ...data,
      slug: await productSlug(data),
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('products')
      .values(itemData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create product item')

    // Read the id the driver reported, never a row count.
    const id = insertedId(result)

    // Postgres reports no insert id without RETURNING; the uuid written above
    // identifies the row on any dialect.
    const model = id !== undefined
      ? await fetchById(id)
      : await getProductByUuid(itemData.uuid)

    if (!model)
      throw new Error('Failed to create product item')

    return model
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product item: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple product items at once
 *
 * @param data Array of product item data to store
 * @returns Number of product items created
 */
export async function bulkStore(data: NewProduct[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction(async (trx) => {
      const claimed = new Set<string>()
      for (const item of data) {
        const itemData = {
          ...item,
          slug: await productSlug(item, trx, claimed),
          uuid: randomUUIDv7(),
        }

        await trx
          .insertInto('products')
          .values(itemData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create product items in bulk: ${error.message}`)
    }

    throw error
  }
}
