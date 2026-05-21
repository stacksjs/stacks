/**
 * Route registry types — owned by `@stacksjs/router` because the router
 * consumes them. `app/Routes.ts` (the project-level route map) imports
 * these via the public package name rather than a relative reach into
 * the framework defaults tree (stacksjs/stacks#1863, T-10).
 */

export interface RouteDefinition {
  /** Route file path (relative to routes/) */
  path: string
  /** Optional URL prefix (overrides the key-based prefix) */
  prefix?: string
  /** Optional middleware for all routes in file */
  middleware?: string | string[]
}

export type RouteRegistry = Record<string, string | RouteDefinition>
