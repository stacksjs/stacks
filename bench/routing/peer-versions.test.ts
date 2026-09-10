import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { resolvePeerVersions, selectedPeerPackages } from './peer-versions'

describe('benchmark peer versions', () => {
  it('maps only selected framework targets to package names', () => {
    expect(selectedPeerPackages(['stacks', 'hono', 'bun-raw', 'elysia'])).toEqual(['hono', 'elysia'])
  })

  it('reads the exact versions resolved by the benchmark server context', async () => {
    const manifest = await Bun.file(join(import.meta.dir, 'package.json')).json() as { dependencies: Record<string, string | undefined> }
    const { hono, elysia } = manifest.dependencies
    // The comparison is only meaningful against a pinned peer. An absent one
    // would make this assert that two unavailable values match.
    if (hono == null || elysia == null)
      throw new Error('the benchmark package must pin hono and elysia')
    expect(await resolvePeerVersions(['stacks', 'hono', 'bun-raw', 'elysia'])).toEqual({ hono, elysia })
  })
})
