export interface MemoryProfileTarget {
  targetId: string
  label: string
  requestRate: number
}

/** Equal-work API profile using the lower rate every included target can sustain. */
export const EQUAL_RATE_API_PROFILE: readonly MemoryProfileTarget[] = [
  { targetId: 'stacks-warm', label: 'Stacks', requestRate: 25_000 },
  { targetId: 'express', label: 'Express', requestRate: 25_000 },
  { targetId: 'fastify', label: 'Fastify', requestRate: 25_000 },
  { targetId: 'elysia', label: 'Elysia', requestRate: 25_000 },
  { targetId: 'hono', label: 'Hono', requestRate: 25_000 },
  { targetId: 'bun-raw', label: 'Bun.serve baseline', requestRate: 25_000 },
]
