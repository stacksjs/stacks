import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runApplicationSeeders } from '../src/seeder'

/**
 * Selecting a SET of seeders without naming each one.
 *
 * A deploy wants "the cheap, idempotent ones" — a property of the seeder, not
 * of the deploy. Expressed as a `--only-seeders A,B,C` list in a deploy config
 * it goes stale the moment somebody adds a seeder: the new one is safe to run,
 * nobody remembers the list exists, and the surface it fills stays empty in
 * every environment built from that config.
 */
describe('application seeder tags', () => {
  const write = async (dir: string, name: string, body: string) =>
    writeFile(path.join(dir, name), body)

  const seederSource = (name: string, tags: string[] | null) => `
    import { Seeder } from '${path.resolve(import.meta.dir, '../src/seeder.ts')}'
    export default class ${name} extends Seeder {
      ${tags === null ? '' : `static tags = ${JSON.stringify(tags)}`}
      async run() {
        globalThis.__seedRan ??= []
        globalThis.__seedRan.push('${name}')
      }
    }
  `

  async function withSeeders(
    files: Array<[string, string[] | null]>,
    run: (dir: string) => Promise<void>,
  ): Promise<string[]> {
    const dir = await mkdtemp(path.join(tmpdir(), 'seeder-tags-'))
    try {
      ;(globalThis as any).__seedRan = []
      for (const [name, tags] of files)
        await write(dir, `${name}.ts`, seederSource(name, tags))
      await run(dir)
      return (globalThis as any).__seedRan as string[]
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('runs only the seeders carrying the tag', async () => {
    const ran = await withSeeders(
      [['UserSeeder', ['deploy']], ['TrailSeeder', ['corpus']], ['AdminSeeder', ['deploy']]],
      dir => runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy'] }).then(() => {}),
    )

    expect(ran.sort()).toEqual(['AdminSeeder', 'UserSeeder'])
  })

  it('leaves an untagged seeder out of a tagged run', async () => {
    // The safe default. A seeder that never says it is cheap is not assumed to
    // be, so adding one cannot slow a deploy down until somebody says it may.
    const ran = await withSeeders(
      [['UserSeeder', ['deploy']], ['LegacySeeder', null]],
      dir => runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy'] }).then(() => {}),
    )

    expect(ran).toEqual(['UserSeeder'])
  })

  it('matches a seeder carrying any one of several tags', async () => {
    const ran = await withSeeders(
      [['A', ['deploy', 'demo']], ['B', ['demo']], ['C', ['corpus']]],
      dir => runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy'] }).then(() => {}),
    )

    expect(ran).toEqual(['A'])
  })

  it('accepts several tags at once', async () => {
    const ran = await withSeeders(
      [['A', ['deploy']], ['B', ['demo']], ['C', ['corpus']]],
      dir => runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy', 'demo'] }).then(() => {}),
    )

    expect(ran.sort()).toEqual(['A', 'B'])
  })

  it('runs everything when no tag is given, exactly as before', async () => {
    const ran = await withSeeders(
      [['A', ['deploy']], ['B', null]],
      dir => runApplicationSeeders({ directory: dir, verbose: false }).then(() => {}),
    )

    expect(ran.sort()).toEqual(['A', 'B'])
  })

  it('combines with an exclusion rather than replacing it', async () => {
    // `--tag deploy --except-seeders B` has to mean what it reads like.
    const ran = await withSeeders(
      [['A', ['deploy']], ['B', ['deploy']]],
      dir => runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy'], except: ['B'] }).then(() => {}),
    )

    expect(ran).toEqual(['A'])
  })

  it('still honours order within a tagged run', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'seeder-tags-'))
    try {
      ;(globalThis as any).__seedRan = []
      const withOrder = (name: string, order: number) => `
        import { Seeder } from '${path.resolve(import.meta.dir, '../src/seeder.ts')}'
        export default class ${name} extends Seeder {
          static tags = ['deploy']
          static order = ${order}
          async run() { globalThis.__seedRan.push('${name}') }
        }
      `
      await write(dir, 'ClubSeeder.ts', withOrder('ClubSeeder', 10))
      await write(dir, 'UserSeeder.ts', withOrder('UserSeeder', 1))

      await runApplicationSeeders({ directory: dir, verbose: false, tags: ['deploy'] })

      expect((globalThis as any).__seedRan).toEqual(['UserSeeder', 'ClubSeeder'])
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
