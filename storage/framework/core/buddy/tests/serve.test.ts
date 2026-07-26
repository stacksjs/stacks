import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { resolveUserPartialsPath } from '../src/commands/serve'

describe('buddy serve partials resolution', () => {
  it('uses resources/components for modern Stacks app includes', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-serve-partials-'))
    const components = join(root, 'resources', 'components')
    mkdirSync(components, { recursive: true })

    expect(resolveUserPartialsPath(root)).toBe(components)
  })

  it('preserves the conventional partials directory when it exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-serve-partials-'))
    const partials = join(root, 'resources', 'partials')
    mkdirSync(partials, { recursive: true })

    expect(resolveUserPartialsPath(root)).toBe(partials)
  })

  it('honors a configured partialsDir over a conventional directory that also exists', () => {
    // The shape that broke production: includes live in resources/components
    // and config/stx.ts points there, but an unrelated resources/partials also
    // exists. Probing conventions first picked partials and every @include
    // 404'd at runtime.
    const root = mkdtempSync(join(tmpdir(), 'stacks-serve-partials-'))
    const components = join(root, 'resources', 'components')
    mkdirSync(components, { recursive: true })
    mkdirSync(join(root, 'resources', 'partials'), { recursive: true })

    expect(resolveUserPartialsPath(root, 'components')).toBe(components)
  })

  it('accepts a configured directory spelled from the app root', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-serve-partials-'))
    const components = join(root, 'resources', 'components')
    mkdirSync(components, { recursive: true })

    expect(resolveUserPartialsPath(root, 'resources/components')).toBe(components)
  })

  it('falls back to conventions when the configured directory does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-serve-partials-'))
    const partials = join(root, 'resources', 'partials')
    mkdirSync(partials, { recursive: true })

    expect(resolveUserPartialsPath(root, 'nope')).toBe(partials)
  })
})
