import { parseSqlDateTime } from '@stacksjs/database/runtime'

/** Keep malformed metadata invalid instead of fabricating a current timestamp. */
export function tokenDate(value: unknown): Date {
  return parseSqlDateTime(value) ?? new Date(Number.NaN)
}

/** SQL strings are UTC; driver Date objects already represent an instant. */
export function tokenTimestamps(row: { created_at?: unknown, updated_at?: unknown }): { createdAt: Date, updatedAt: Date } {
  return {
    createdAt: tokenDate(row.created_at),
    // An unused token was last active when issued, not when its list was read.
    updatedAt: tokenDate(row.updated_at ?? row.created_at),
  }
}
