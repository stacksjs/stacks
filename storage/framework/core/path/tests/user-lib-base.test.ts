import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { componentsPath, functionsPath, resolveUserLibBase } from '../src/index'

/**
 * Root-level `functions/` and `components/` folders (stacksjs/stacks#929).
 * A project-root folder wins when it exists; otherwise the conventional
 * `resources/<name>`.
 */

describe('resolveUserLibBase (pure selector)', () => {
  it('returns the root dir when it exists', () => {
    const base = resolveUserLibBase('/p/components', '/p/resources/components', () => true)
    expect(base).toBe('/p/components')
  })

  it('falls back to resources when the root dir is absent', () => {
    const base = resolveUserLibBase('/p/components', '/p/resources/components', () => false)
    expect(base).toBe('/p/resources/components')
  })

  it('only treats the exact root dir as the signal', () => {
    const seen: string[] = []
    resolveUserLibBase('/p/functions', '/p/resources/functions', (path) => {
      seen.push(path)
      return false
    })
    expect(seen).toEqual(['/p/functions'])
  })
})

describe('componentsPath / functionsPath integration', () => {
  let scratch: string | null = null
  afterEach(() => {
    if (scratch && existsSync(scratch)) rmSync(scratch, { recursive: true, force: true })
    scratch = null
  })

  it('default (no root folder) resolves under resources/', () => {
    // In this framework checkout there is no root-level components/ or
    // functions/ folder, so the conventional resources/ path is used.
    expect(componentsPath('Button.stx')).toContain('resources/components/Button.stx')
    expect(functionsPath('useThing.ts')).toContain('resources/functions/useThing.ts')
  })

  it('selector picks a real root-level dir over a missing resources dir', () => {
    scratch = mkdtempSync(join(tmpdir(), 'stacks-userlib-'))
    const root = join(scratch, 'components')
    mkdirSync(root, { recursive: true })
    const resources = join(scratch, 'resources', 'components')
    // root exists, resources doesn't → root wins
    expect(resolveUserLibBase(root, resources)).toBe(root)
  })
})
