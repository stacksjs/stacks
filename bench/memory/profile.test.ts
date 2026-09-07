import { describe, expect, it } from 'bun:test'
import { EQUAL_RATE_API_PROFILE } from './profile'

describe('equal-rate idle-memory comparison profile', () => {
  it('assigns identical work to every equivalent API target', () => {
    expect(EQUAL_RATE_API_PROFILE).toEqual([
      { targetId: 'stacks-warm', label: 'Stacks (stock defaults, warm client)', requestRate: 25_000 },
      { targetId: 'stacks-minimal', label: 'Stacks (minimal API profile)', requestRate: 25_000 },
      { targetId: 'express', label: 'Express', requestRate: 25_000 },
      { targetId: 'fastify', label: 'Fastify', requestRate: 25_000 },
      { targetId: 'elysia', label: 'Elysia', requestRate: 25_000 },
      { targetId: 'hono', label: 'Hono', requestRate: 25_000 },
      { targetId: 'bun-raw', label: 'Bun.serve baseline', requestRate: 25_000 },
    ])
    expect(new Set(EQUAL_RATE_API_PROFILE.map(target => target.requestRate))).toEqual(new Set([25_000]))
  })

  it('keeps stock-default and capability-equivalent Stacks profiles explicit', () => {
    expect(EQUAL_RATE_API_PROFILE.slice(0, 2).map(target => target.targetId)).toEqual(['stacks-warm', 'stacks-minimal'])
  })
})
