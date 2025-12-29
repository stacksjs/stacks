export interface RouteDefinition {
  /** Route file path (relative to routes/) */
  path: string
  /** Optional URL prefix (overrides the key-based prefix) */
  prefix?: string
  /** Optional middleware for all routes in file */
  middleware?: string | string[]
}

export type RouteRegistry = Record<string, string | RouteDefinition>

/**
 * Application route registry.
 *
 * Define your route files here. The key becomes the URL prefix automatically.
 * Special keys 'api' and 'web' have no prefix (loaded at root /).
 *
 * @example
 * // No prefix - routes/api.ts loaded at /*
 * 'api': 'api',
 *
 * // Auto prefix from key - routes/api/v1.ts loaded at /v1/*
 * 'v1': 'api/v1',
 *
 * // Explicit prefix - routes/api/v1.ts loaded at /api/v1/*
 * 'legacy': { path: 'api/v1', prefix: '/api/v1' },
 *
 * // No prefix override - routes/internal.ts loaded at /* (no prefix)
 * 'internal': { path: 'internal', prefix: '' },
 *
 * // With middleware - routes/admin.ts loaded at /admin/* with auth
 * 'admin': { path: 'admin', middleware: ['auth'] },
 */
export default {
  // Default API routes (no prefix)
  'api': 'api',

  // Add versioned or prefixed routes here:
  'v1': { path: '/', prefix: 'v1' }
  // 'v2': 'api/v2',
  // 'admin': { path: 'admin', middleware: ['auth'] },
} satisfies RouteRegistry
