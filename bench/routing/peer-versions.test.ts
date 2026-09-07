import { describe, expect, it } from 'bun:test'
import { selectedPeerPackages } from './peer-versions'

describe('benchmark peer versions', () => {
  it('maps only selected framework targets to package names', () => {
    expect(selectedPeerPackages(['stacks', 'hono', 'bun-raw', 'elysia'])).toEqual(['hono', 'elysia'])
  })
})
