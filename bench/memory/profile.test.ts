import { describe, expect, it } from 'bun:test'
import { BUN_141_API_PROFILE } from './profile'

describe('Bun 1.4.1 idle-memory comparison profile', () => {
  it('loads Stacks at the highest API rate in the reference graphic', () => {
    expect(BUN_141_API_PROFILE[0]).toEqual({ targetId: 'stacks-warm', label: 'Stacks', requestRate: 40_000 })
  })

  it('uses the published fixed rates for equivalent API frameworks', () => {
    expect(BUN_141_API_PROFILE).toEqual([
      { targetId: 'stacks-warm', label: 'Stacks', requestRate: 40_000 },
      { targetId: 'express', label: 'Express', requestRate: 25_000 },
      { targetId: 'fastify', label: 'Fastify', requestRate: 25_000 },
      { targetId: 'elysia', label: 'Elysia', requestRate: 40_000 },
      { targetId: 'hono', label: 'Hono', requestRate: 40_000 },
      { targetId: 'bun-raw', label: 'Bun.serve baseline', requestRate: 40_000 },
    ])
  })
})
