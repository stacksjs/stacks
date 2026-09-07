import { describe, expect, it, mock } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A trait Stacks does not read says so, once, by name.
 *
 * `traits` is not a closed type at the call site and cannot be made one:
 * `defineModel` is generic, so TypeScript infers the definition's own shape and
 * then checks it against the constraint - and assignability permits extra
 * properties. `traits: { useTimestamp: true }`, one letter short of
 * `useTimestamps`, compiled clean and the model simply had no `created_at`. You
 * find that from a column that is missing, not from anything that says so.
 *
 * `useActivityLog` is the case that surfaced it: declared upstream in
 * bun-query-builder's trait type, read by nothing in this framework, and
 * therefore silent for as long as anyone set it (stacksjs/stacks#2435).
 */

const warnings: string[] = []

mock.module('@stacksjs/logging', () => ({
  log: {
    debug: () => {},
    info: () => {},
    error: () => {},
    success: () => {},
    warn: (message: string) => { warnings.push(String(message)) },
    flush: () => Promise.resolve(),
  },
}))

async function define(traits: Record<string, unknown>): Promise<string[]> {
  warnings.length = 0
  const { defineModel } = await import('../src/define-model')
  defineModel({ name: 'Probe', table: 'probes', traits, attributes: {} } as any)
  return warnings.filter(line => line.includes('unknown trait'))
}

describe('defineModel', () => {
  it('names a trait it does not know', async () => {
    const said = await define({ useTimestamp: true })

    expect(said).toHaveLength(1)
    expect(said[0]).toContain(`'useTimestamp'`)
    // The known set is listed, because the whole difficulty is that the author
    // believes they typed a real one.
    expect(said[0]).toContain('useTimestamps')
  })

  it('says nothing for the traits it reads', async () => {
    expect(await define({ useTimestamps: true, useUuid: true, observe: true })).toEqual([])
  })

  it('accepts both spellings where an alias exists', async () => {
    expect(await define({ timestampable: true, softDeletable: true, searchable: true, seedable: true })).toEqual([])
  })

  it('reports every unknown trait, not just the first', async () => {
    expect(await define({ useTimestamp: true, categorisable: true })).toHaveLength(2)
  })

  /**
   * The list is values, so the framework's own READS are the check on it.
   *
   * Checking it against the built-in models is not enough and was actively
   * misleading: `useAudit`, `prunable` and `sharding` are all implemented, and
   * not one of the 97 models declares any of them - so a list validated that
   * way passed while warning on three working traits.
   */
  it('knows every trait the framework reads', async () => {
    const core = join(import.meta.dir, '..', '..')
    const read = new Set<string>()

    const walk = (d: string) => {
      let entries
      try {
        entries = readdirSync(d, { withFileTypes: true })
      }
      catch {
        return
      }
      for (const entry of entries) {
        const p = join(d, entry.name)
        if (entry.isDirectory()) {
          walk(p)
          continue
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts'))
          continue
        const source = readFileSync(p, 'utf8')
          // Prose in a docblock is not a read.
          .split('\n').filter(line => !/^\s*(\*|\/\/)/.test(line)).join('\n')
        // `traits.join(', ')` is an array method on a local of that name, and
        // `types/traits.d.ts` is a filename. Neither is a trait read.
        for (const match of source.matchAll(/traits\??\.\??([a-zA-Z_]\w*)(.?)/g)) {
          if (match[2] === '(' || match[1] === 'd')
            continue
          read.add(match[1])
        }
      }
    }

    for (const pkg of readdirSync(core))
      walk(join(core, pkg, 'src'))

    expect(read.size).toBeGreaterThan(10)

    const unknown: string[] = []
    for (const trait of read) {
      if ((await define({ [trait]: true })).length > 0)
        unknown.push(trait)
    }

    expect(unknown.sort()).toEqual([])
  })

  it('knows every trait the built-in models declare', async () => {
    const dir = join(import.meta.dir, '..', '..', '..', 'defaults', 'app', 'Models')
    const files: string[] = []
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name)
        if (entry.isDirectory())
          walk(p)
        else if (entry.name.endsWith('.ts')) files.push(p)
      }
    }
    walk(dir)
    expect(files.length).toBeGreaterThan(50)

    const declared = new Set<string>()
    for (const file of files) {
      const block = readFileSync(file, 'utf8').match(/traits:\s*\{([\s\S]*?)\n {2}\}/)
      if (!block)
        continue
      for (const key of block[1].matchAll(/^ {4}(\w+)\s*:/gm))
        declared.add(key[1])
    }

    const unknown: string[] = []
    for (const trait of declared) {
      if ((await define({ [trait]: true })).length > 0)
        unknown.push(trait)
    }

    expect(unknown.sort()).toEqual([])
  })
})
