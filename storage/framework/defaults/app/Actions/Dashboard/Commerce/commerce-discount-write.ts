import { randomUUIDv7 } from 'bun'
import { db, mutationCount } from '@stacksjs/database/runtime'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
import type { DiscountRecord, DiscountWritePayload } from './discount-records'
import { discountWriteData, normalizeDiscountRecord } from './discount-records'

/**
 * Creating, changing and removing discounts from the dashboard. Every write
 * goes through `discountWriteData`, which prices the rule once with the
 * engine, so what is saved is what a checkout can use.
 */

export type DiscountSaveResult =
  | { ok: true, record: DiscountRecord }
  | { ok: false, status: 404 | 422, message: string, errors?: Record<string, string> }

export async function saveDiscount(id: number | null, payload: DiscountWritePayload, currency = 'USD', run: any = db): Promise<DiscountSaveResult> {
  const checked = discountWriteData(payload)
  if (!checked.ok)
    return { ok: false, status: 422, message: 'The discount could not be saved.', errors: checked.errors }

  const now = formatDate(new Date())
  try {
    if (id === null) {
      const uuid = randomUUIDv7()
      await run.insertInto('discounts').values({ ...checked.data, uuid, usage_count: 0, created_at: now, updated_at: now }).execute()
      const row = await run.selectFrom('discounts').where('uuid', '=', uuid).selectAll().executeTakeFirst()
      return { ok: true, record: normalizeDiscountRecord(row, now, currency) }
    }

    const result = await run.updateTable('discounts').set({ ...checked.data, updated_at: now }).where('id', '=', id).executeTakeFirst()
    if (mutationCount(result) === 0)
      return { ok: false, status: 404, message: `Discount ${id} does not exist.` }
    const row = await run.selectFrom('discounts').where('id', '=', id).selectAll().executeTakeFirst()
    return { ok: true, record: normalizeDiscountRecord(row, now, currency) }
  }
  catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, status: 422, message: 'Another discount already uses that code.', errors: { code: 'is already used by another discount' } }
    throw error
  }
}

/** Remove a discount. Orders keep the amount it took off; nothing points at the row. */
export async function deleteDiscount(id: number, run: any = db): Promise<boolean> {
  const result = await run.deleteFrom('discounts').where('id', '=', id).executeTakeFirst()
  return mutationCount(result) > 0
}

/** Field errors in the `{ field: [message] }` shape the dashboard's API client reads. */
export function asFieldErrors(errors: Record<string, string> | undefined): Record<string, string[]> | undefined {
  return errors ? Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]])) : undefined
}
