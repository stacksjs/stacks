import { describe, expect, it } from 'bun:test'
import { uniqueSlug } from '../src/unique'

/**
 * `uniqueSlug` inside a batch (stacksjs/stacks#3005).
 *
 * It checked only the global connection, so a write running in a transaction
 * could not see its own uncommitted rows, and two products named alike in one
 * bulk insert or import were both handed the same slug, failing the unique
 * index. A caller can now pass the connection to check and the slugs it has
 * already handed out.
 */
function connection(taken: Set<string>, seen: string[] = []): any {
  return {
    selectFrom: () => ({
      select: () => ({
        where: (_column: string, _operator: string, value: string) => ({
          executeTakeFirst: async () => {
            seen.push(value)
            return taken.has(value) ? { id: 1 } : undefined
          },
        }),
      }),
    }),
  }
}

describe('uniqueSlug', () => {
  it('checks the connection it is given', async () => {
    const seen: string[] = []
    const slug = await uniqueSlug('Trail Runner', { table: 'products', column: 'slug', connection: connection(new Set(['trail-runner']), seen) })
    expect(slug).toBe('trail-runner-2')
    expect(seen).toEqual(['trail-runner', 'trail-runner-2'])
  })

  it('skips a slug already claimed in the same batch, and claims what it returns', async () => {
    const claimed = new Set<string>()
    const options = { table: 'products' as const, column: 'slug', connection: connection(new Set()), claimed }
    expect(await uniqueSlug('Trail Runner', options)).toBe('trail-runner')
    expect(await uniqueSlug('Trail Runner', options)).toBe('trail-runner-2')
    expect([...claimed]).toEqual(['trail-runner', 'trail-runner-2'])
  })
})
