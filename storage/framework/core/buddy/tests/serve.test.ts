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
})
