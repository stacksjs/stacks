import { db, sql } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
type ProductJsonResponse = ModelRow<typeof Product>
type ProductUpdate = UpdateModelData<typeof Product>
import { fetchById } from './fetch'

/**
 * Update a product item
 *
 * @param id The ID of the product item to update
 * @param data The product item data to update
 * @returns The updated product item record
 */
export async function update(id: number, data: Omit<ProductUpdate, 'id'>): Promise<ProductJsonResponse> {
  try {
    if (!id)
      throw new Error('Product item ID is required for update')

    const result = await db
      .updateTable('products')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update product item')

    return result as ProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product item: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update multiple product items at once
 *
 * @param data Array of product item updates
 * @returns Number of product items updated
 */
export async function bulkUpdate(data: ProductUpdate[]): Promise<number> {
  if (!data.length)
    return 0

  let updatedCount = 0

  try {
    await (db as any).transaction().execute(async (trx: any) => {
      for (const item of data) {
        if (!(item as Record<string, unknown>).id)
          continue

        const result = await trx
          .updateTable('products')
          .set({
            ...item,
            updated_at: formatDate(new Date()),
          })
          .where('id', '=', (item as Record<string, unknown>).id)
          .executeTakeFirst()

        if (Number(result.numUpdatedRows) > 0)
          updatedCount++
      }
    })

    return updatedCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product items in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a product item's availability status
 *
 * @param id The ID of the product item
 * @param isAvailable The new availability status
 * @returns The updated product item with the new availability status
 */
export async function updateAvailability(
  id: number,
  isAvailable: boolean,
): Promise<ProductJsonResponse | undefined> {
  // Check if product item exists
  const productItem = await fetchById(id)

  if (!productItem) {
    throw new Error(`Product item with ID ${id} not found`)
  }

  try {
    // Update the product item availability
    await db
      .updateTable('products')
      .set({
        is_available: isAvailable,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated product item
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update product item availability: ${error.message}`)
    }

    throw error
  }
}

/**
 * Atomically decrement (or increment) a product's inventory count by `delta`.
 *
 * Returns the updated row, or `null` if the requested decrement would push
 * inventory below zero — that's how callers detect "we sold the last one"
 * during checkout. The conditional UPDATE means two parallel checkout
 * requests can't both observe stock=1 and both succeed; the second one
 * matches zero rows and the function returns null. Existing
 * `updateInventory(id, count)` keeps the previous "set absolute count"
 * semantics for admin tooling.
 */
export async function adjustInventory(
  id: number,
  delta: number,
): Promise<ProductJsonResponse | null> {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('[commerce/inventory] adjustInventory delta must be a non-zero finite number')
  }

  const result: any = await db
    .updateTable('products')
    .set({
      inventory_count: sql`inventory_count + ${delta}`,
      updated_at: formatDate(new Date()),
    })
    .where('id', '=', id)
    // Guard against negative stock when decrementing.
    .where(sql`inventory_count + ${delta}`, '>=', 0)
    .execute()

  // Drivers report affected rows differently — handle the common shapes.
  const affected = Number(
    result?.numUpdatedRows
    ?? result?.[0]?.numUpdatedRows
    ?? result?.numAffectedRows
    ?? 0,
  )

  if (!affected) return null
  return (await fetchById(id)) ?? null
}

/**
 * Discriminated result for `adjustInventoryMany` — `ok: true` when
 * every per-item adjustment succeeded; `ok: false` with `failedAt`
 * (the index in the input array that triggered the rollback) when
 * any single item couldn't be adjusted (out of stock, missing,
 * etc.). All adjustments roll back as a unit on failure.
 */
export type InventoryBatchResult =
  | { ok: true, products: ProductJsonResponse[] }
  | { ok: false, failedAt: number, productId: number, reason: 'out-of-stock' | 'not-found' }

/**
 * Atomic batch inventory adjustment (stacksjs/stacks#1879 Co-2).
 *
 * Pre-fix: a multi-item cart called `adjustInventory(id, delta)` N
 * times sequentially. If item 2 failed (out of stock), item 1's
 * decrement was already committed with no rollback — the order
 * persisted with partial stock reservation and the customer saw
 * a refund-on-next-page-load surprise.
 *
 * Post-fix: wraps the per-item loop in `db.transaction`. Any item
 * that can't be adjusted (the existing `adjustInventory` returns
 * null on insufficient stock) throws inside the transaction; the
 * driver rolls every prior decrement back. Returns a discriminated
 * result so the cart handler can surface "item X was out of stock"
 * specifically instead of a generic transaction-failed error.
 *
 * @example
 * ```ts
 * const result = await adjustInventoryMany([
 *   { id: cart.itemA, delta: -2 },
 *   { id: cart.itemB, delta: -1 },
 * ])
 * if (!result.ok) {
 *   throw new HttpError(409, `Item ${result.productId} is out of stock`)
 * }
 * ```
 */
export async function adjustInventoryMany(
  updates: ReadonlyArray<{ id: number, delta: number }>,
): Promise<InventoryBatchResult> {
  if (updates.length === 0) return { ok: true, products: [] }

  try {
    const products = await db.transaction(async (trx: any) => {
      const out: ProductJsonResponse[] = []
      for (let i = 0; i < updates.length; i++) {
        const { id, delta } = updates[i]!
        if (!Number.isFinite(delta) || delta === 0)
          throw new Error('[commerce/inventory] adjustInventoryMany delta must be a non-zero finite number')

        // Same atomic UPDATE as adjustInventory, but routed through
        // the transaction handle so all decrements share a single
        // commit boundary.
        const result: any = await trx
          .updateTable('products')
          .set({
            inventory_count: sql`inventory_count + ${delta}`,
            updated_at: formatDate(new Date()),
          })
          .where('id', '=', id)
          .where(sql`inventory_count + ${delta}`, '>=', 0)
          .execute()

        const affected = Number(
          result?.numUpdatedRows
          ?? result?.[0]?.numUpdatedRows
          ?? result?.numAffectedRows
          ?? 0,
        )

        if (!affected) {
          // Throw a structured error the outer try/catch can convert
          // into a discriminated result. Driver rolls back automatically.
          const exists = await trx.selectFrom('products').where('id', '=', id).select('id').executeTakeFirst()
          const reason = exists ? 'out-of-stock' : 'not-found'
          throw Object.assign(new Error(`adjustInventoryMany failed at index ${i}: ${reason}`), {
            __batchFail: true,
            failedAt: i,
            productId: id,
            reason,
          })
        }

        const refreshed = await trx.selectFrom('products').where('id', '=', id).selectAll().executeTakeFirst()
        if (refreshed) out.push(refreshed as ProductJsonResponse)
      }
      return out
    })
    return { ok: true, products }
  }
  catch (err: any) {
    if (err?.__batchFail) {
      return {
        ok: false,
        failedAt: err.failedAt as number,
        productId: err.productId as number,
        reason: err.reason as 'out-of-stock' | 'not-found',
      }
    }
    // Real error (network, schema, etc.) — surface to caller.
    throw err
  }
}

/**
 * Update inventory information for a product item
 *
 * @param id The ID of the product item
 * @param inventoryCount The updated inventory count
 * @returns The updated product item
 */
export async function updateInventory(
  id: number,
  inventoryCount?: number,
): Promise<ProductJsonResponse | undefined> {
  // Check if product item exists
  const productItem = await fetchById(id)

  if (!productItem) {
    throw new Error(`Product item with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (inventoryCount !== undefined) {
    updateData.inventory_count = inventoryCount
  }

  // If no inventory fields to update, just return the existing product item
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return productItem
  }

  try {
    // Update the product item
    await db
      .updateTable('products')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated product item
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update inventory information: ${error.message}`)
    }

    throw error
  }
}
