export interface MemoryProfileTarget {
  targetId: string
  label: string
  requestRate: number
}

/**
 * API workloads from Bun 1.4.1's idle-RSS graphic.
 *
 * Stacks is held to the higher 40k req/s tier. Next.js SSR and Vite dev are
 * intentionally excluded because a JSON API response is not equivalent to an
 * SSR render or a development transform.
 */
export const BUN_141_API_PROFILE: readonly MemoryProfileTarget[] = [
  { targetId: 'stacks-warm', label: 'Stacks', requestRate: 40_000 },
  { targetId: 'express', label: 'Express', requestRate: 25_000 },
  { targetId: 'fastify', label: 'Fastify', requestRate: 25_000 },
  { targetId: 'elysia', label: 'Elysia', requestRate: 40_000 },
  { targetId: 'hono', label: 'Hono', requestRate: 40_000 },
  { targetId: 'bun-raw', label: 'Bun.serve baseline', requestRate: 40_000 },
]
