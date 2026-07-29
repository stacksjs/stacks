import { sqlHelpers } from '@stacksjs/database'
import { env } from '@stacksjs/env'
import { mutationCount } from './mutation-count'

interface UnsafeConnection {
  unsafe: (query: string, parameters?: unknown[]) => unknown
}

export function inventoryAdjustmentStatement(
  driver: string,
  productId: number,
  delta: number,
  updatedAt: string,
): { query: string, parameters: unknown[] } {
  const p = sqlHelpers(driver).param
  return {
    query: `UPDATE products
      SET inventory_count = inventory_count + ${p(1)},
          updated_at = ${p(2)}
      WHERE id = ${p(3)}
        AND inventory_count + ${p(4)} >= 0`,
    parameters: [delta, updatedAt, productId, delta],
  }
}

/**
 * Apply one guarded inventory delta through the supplied connection.
 *
 * Passing a transaction-scoped connection keeps this write on the reserved
 * transaction connection. The conditional UPDATE is the concurrency guard:
 * an insufficient decrement matches zero rows instead of producing negative
 * stock.
 */
export async function adjustInventoryOnConnection(
  connection: UnsafeConnection,
  productId: number,
  delta: number,
  updatedAt: string,
): Promise<number> {
  const statement = inventoryAdjustmentStatement(
    env.DB_CONNECTION || 'sqlite',
    productId,
    delta,
    updatedAt,
  )
  const pending = await connection.unsafe(statement.query, statement.parameters)
  const result = typeof (pending as any)?.execute === 'function'
    ? await (pending as any).execute()
    : pending
  return mutationCount(result)
}
