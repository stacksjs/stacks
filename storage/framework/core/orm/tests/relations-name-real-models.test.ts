import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every relation names a model that exists.
 *
 * A relation to a model that does not exist is not inert. The ORM lists it as
 * available - `User.hasMany: ['PersonalAccessToken']` put that name in the
 * "Available: …" line the ORM prints when it rejects an unknown relation - and
 * then `User.with('PersonalAccessToken')` failed with
 * `no such table: personal_access_tokens`. So the framework advertised a
 * relation and threw a SQL error at anyone who took it up. Bearer tokens live
 * in `oauth_access_tokens` / `oauth_refresh_tokens`, which the auth layer owns
 * directly and gives no model at all.
 *
 * Checked by reading the definitions rather than by loading them, so one broken
 * relation reports as itself instead of as whatever the loader throws first.
 */

const root = join(import.meta.dir, '..', '..', '..', '..', '..')
const RELATION_KINDS = ['belongsTo', 'hasMany', 'hasOne', 'belongsToMany'] as const

function modelFiles(dir: string, found: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return found
  }

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      modelFiles(path, found)
    else if (entry.name.endsWith('.ts'))
      found.push(path)
  }
  return found
}

describe('model relations', () => {
  // An application's own models count too: a default may not point at one, but
  // an app model pointing at another app model is the same question.
  const files = [
    ...modelFiles(join(root, 'storage/framework/defaults/app/Models')),
    ...modelFiles(join(root, 'app/Models')),
  ]

  const sources = new Map(files.map(file => [file, readFileSync(file, 'utf8')]))
  const declared = new Set(
    [...sources.values()]
      .map(source => source.match(/name:\s*'([A-Za-z]\w*)'/)?.[1])
      .filter((name): name is string => Boolean(name)),
  )

  it('has models to check', () => {
    expect(declared.size).toBeGreaterThan(50)
  })

  it('name a model that exists', () => {
    const dangling: string[] = []

    for (const [file, source] of sources) {
      const self = source.match(/name:\s*'([A-Za-z]\w*)'/)?.[1] ?? file

      for (const kind of RELATION_KINDS) {
        // The array form. The object form spells its targets as keys, which
        // `defineModel`'s own types already constrain to model names.
        const block = new RegExp(`${kind}\\s*:\\s*\\[([^\\]]*)\\]`).exec(source)
        if (!block)
          continue

        for (const target of block[1].matchAll(/'([A-Za-z]\w*)'/g)) {
          if (!declared.has(target[1]))
            dangling.push(`${self}.${kind} names '${target[1]}', which is not a model`)
        }
      }
    }

    expect([...new Set(dangling)].sort()).toEqual([])
  })
})
