/**
 * Which filename a config is read from (stacksjs/stacks#2446).
 *
 * stx accepts either `config/stx.ts` or `config/ui.ts` - `loadStxConfig`
 * resolves `{ name: 'stx', alias: 'ui' }`. This loader accepted only `ui.ts`,
 * and `loadStxPartialsDir` in the production server accepted only `stx.ts`.
 * No single filename satisfied all three consumers, and both misses were
 * silent.
 *
 * The one that mattered: under `config/stx.ts`, `config.ui` was undefined, and
 * `resolveViewPatterns` treats undefined exactly like `true` - so an app that
 * set `defaultViews: ['errors', 'emails']` to stop serving the framework's demo
 * storefront kept serving it, through a green build and a green deploy.
 */
import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveUserConfigName } from '../src/overrides'

function project(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'user-config-name-'))
  mkdirSync(join(root, 'config'), { recursive: true })
  for (const f of files)
    writeFileSync(join(root, 'config', f), 'export default {}\n')
  return root
}

describe('resolveUserConfigName', () => {
  it('reads the primary name when that is what the project ships', () => {
    const root = project(['ui.ts'])
    try {
      expect(resolveUserConfigName(['ui', 'stx'], root)).toBe('ui')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('reads the alternative name, which is the whole bug', () => {
    // Red before the fix: the loader looked only for `ui.ts`, found nothing,
    // and left `config.ui` undefined while stx read `stx.ts` perfectly well.
    const root = project(['stx.ts'])
    try {
      expect(resolveUserConfigName(['ui', 'stx'], root)).toBe('stx')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('prefers the primary when a project ships both', () => {
    const root = project(['ui.ts', 'stx.ts'])
    try {
      expect(resolveUserConfigName(['ui', 'stx'], root)).toBe('ui')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('falls back to the primary name when the project ships neither', () => {
    // The loader then imports a path that does not exist, and its ENOENT
    // branch means "this project ships no config of this kind" - which is the
    // common case and must stay silent.
    const root = project([])
    try {
      expect(resolveUserConfigName(['ui', 'stx'], root)).toBe('ui')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('leaves a single-name config exactly as it was', () => {
    const root = project(['database.ts'])
    try {
      expect(resolveUserConfigName(['database'], root)).toBe('database')
      expect(resolveUserConfigName(['queue'], root)).toBe('queue')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('the ui config accepts both of stx own names', () => {
  it('is registered with stx as an alternative', () => {
    // Pinned because the alias is the fix: dropping it silently restores the
    // bug, and every other consumer would still look fine.
    const source = require('node:fs').readFileSync(
      new URL('../src/overrides.ts', import.meta.url),
      'utf8',
    )
    expect(source).toContain(`['ui', 'ui', 'stx']`)
  })
})
