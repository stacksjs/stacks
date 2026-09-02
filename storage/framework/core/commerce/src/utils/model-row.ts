/**
 * Raw query-builder rows, given the spellings their `ModelRow` type promises.
 *
 * `ModelRow<typeof X>` is `DeclaredAttributes & SnakeCaseAttributes`: it types
 * BOTH `currentBalance` and `current_balance` as present. The ORM delivers on
 * that through the accessor proxy on a model row - but this package queries the
 * RAW builder, where a row carries exactly the column names the database has,
 * and there is no ORM query in `core/commerce` at all.
 *
 * Casting a raw row to its `ModelRow` type therefore claimed properties that
 * were `undefined` at runtime, with the cast itself silencing the mismatch.
 * `checkBalance()` read three of them and reported every gift card invalid,
 * because `!undefined` is `true` (stacksjs/stacks#2417).
 *
 * Aliases are ADDED, never substituted. The snake_case keys stay exactly where
 * they are, so `Object.keys`, spreads and JSON responses keep the shape they
 * have today, and the only reads that change are the ones that were silently
 * undefined.
 */

/** `some_column` to `someColumn`. Digits stay attached to the preceding word. */
function toDeclaredSpelling(column: string): string {
  return column.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}

/**
 * One raw row as its model type.
 *
 * The returned object satisfies `T` at runtime rather than merely being cast to
 * it: every underscored column gains its declared spelling first.
 */
export function asModelRow<T>(row: unknown): T
export function asModelRow<T>(row: unknown, allowUndefined: true): T | undefined
export function asModelRow<T>(row: unknown): T | undefined {
  if (row === null || typeof row !== 'object')
    return row as T | undefined

  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) }

  for (const [key, value] of Object.entries(out)) {
    if (!key.includes('_'))
      continue

    const declared = toDeclaredSpelling(key)
    // A column that already carries its declared spelling wins: the database
    // said so, and overwriting it with a derived alias would be a guess.
    if (!(declared in out))
      out[declared] = value
  }

  return out as T
}

/** Every row in a raw result set as its model type. */
export function asModelRows<T>(rows: unknown[]): T[] {
  return rows.map(row => asModelRow<T>(row))
}
