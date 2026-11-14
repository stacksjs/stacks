import { describe, expect, it } from 'bun:test'
import { uniqueSlug } from '../src/unique'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

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

describe('uniqueSlug for titles ts-slug had no letters for', () => {
  it('keeps a Japanese title instead of handing out "" and "-2"', async () => {
    const options = { table: 'posts' as const, column: 'slug', connection: connection(new Set(['日本語のタイトル'])) }
    expect(await uniqueSlug('日本語のタイトル', options)).toBe('日本語のタイトル-2')
  })

  it('gives a title with no letters or digits a random slug', async () => {
    const first = await uniqueSlug('!!!', { table: 'posts', column: 'slug', connection: connection(new Set()) })
    const second = await uniqueSlug('🎉', { table: 'posts', column: 'slug', connection: connection(new Set()) })
    expect(first).toMatch(/^[a-z0-9]{8}$/)
    expect(second).toMatch(/^[a-z0-9]{8}$/)
    expect(first).not.toBe(second)
  })
})

// Public slug results with controlled cryptographic samples catch encoding loss
// and bounded-collision claims; the child prevents crypto mocks leaking to peers.
it('keeps eight base36 digits at both entropy bounds and claims collision fallbacks', async () => {
  const result = await runIsolated(`${import.meta.dir}/fixtures/random-entropy.ts`, {
    cwd: import.meta.dir,
    envFile: false,
    preload: [],
    timeoutMs: 15000,
  })
  assertIsolatedOk(result, 'uniqueSlug bounded crypto entropy OK')
})
