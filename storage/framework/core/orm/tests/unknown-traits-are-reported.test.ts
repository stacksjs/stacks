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
   * The list is values, and the models are the check on it: a trait the
   * framework's own models rely on that is missing here would warn on every
   * boot of every application.
   */
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
