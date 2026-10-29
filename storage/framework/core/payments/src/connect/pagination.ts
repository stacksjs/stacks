/** Read bounded Stripe lists completely; incomplete pages are never financial facts. */
export async function allPages<T extends { id: string }>(read: (after?: string) => Promise<{ data: T[], has_more: boolean }>): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let after: string | undefined
  for (let page = 0; page < 100; page++) {
    const result = await read(after)
    for (const row of result.data) {
      if (!row.id || seen.has(row.id)) throw new Error('Incomplete or repeated Stripe financial page')
      seen.add(row.id)
      rows.push(row)
    }
    if (!result.has_more) return rows
    if (!result.data.length) throw new Error('Incomplete Stripe financial page')
    after = result.data.at(-1)!.id
  }
  throw new Error('Stripe financial pagination exceeded its bound')
}

