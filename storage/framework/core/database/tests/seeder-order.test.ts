import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runApplicationSeeders } from '../src/seeder'

/**
 * Seeders used to run in path order, which is alphabetical and has nothing to
 * do with what depends on what. A ClubSeeder that needs a user to own the club
 * sorted before UserSeeder and quietly seeded nothing — a failure that looks
 * like the seeder being broken rather than early, and that a second `db:seed`
 * "fixes" without explaining why.
 */
describe('application seeder ordering', () => {
  const write = async (dir: string, name: string, body: string) =>
    writeFile(path.join(dir, name), body)

  const seederSource = (order: number | null, name: string) => `
    import { Seeder } from '${path.resolve(import.meta.dir, '../src/seeder.ts')}'
    export default class ${name} extends Seeder {
      ${order === null ? '' : `static order = ${order}`}
      async run() {
        globalThis.__seedOrder ??= []
        globalThis.__seedOrder.push('${name}')
      }
    }
  `

  it('runs lower order first, regardless of filename', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'seeders-'))
    try {
      ;(globalThis as any).__seedOrder = []
      // Alphabetically ClubSeeder precedes UserSeeder; order must override.
      await write(dir, 'ClubSeeder.ts', seederSource(10, 'ClubSeeder'))
      await write(dir, 'UserSeeder.ts', seederSource(1, 'UserSeeder'))

      await runApplicationSeeders({ directory: dir, verbose: false })

      expect((globalThis as any).__seedOrder).toEqual(['UserSeeder', 'ClubSeeder'])
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps path order when nothing declares an order', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'seeders-'))
    try {
      ;(globalThis as any).__seedOrder = []
      await write(dir, 'AaSeeder.ts', seederSource(null, 'AaSeeder'))
      await write(dir, 'BbSeeder.ts', seederSource(null, 'BbSeeder'))

      await runApplicationSeeders({ directory: dir, verbose: false })

      // Unchanged behaviour for every seeder written before `order` existed.
      expect((globalThis as any).__seedOrder).toEqual(['AaSeeder', 'BbSeeder'])
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('still reports a seeder that cannot be imported', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'seeders-'))
    try {
      await write(dir, 'BrokenSeeder.ts', 'this is not valid typescript {{{')
      const summary = await runApplicationSeeders({ directory: dir, verbose: false })

      // Loading moved ahead of running; a broken module must still surface as
      // a failure rather than disappearing from the summary.
      expect(summary.results.some(r => !r.success)).toBe(true)
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
