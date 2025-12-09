import type { Ok } from '@stacksjs/error-handling'
import type { ModelRequest, RequestInstance, Route as StacksRoute } from '@stacksjs/types'
import { ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { camelCase } from '@stacksjs/strings'
import { log } from '@stacksjs/logging'
import { route } from './router'

/**
 * Display all registered routes in a table format
 *
 * @example
 * ```ts
 * import { listRoutes } from '@stacksjs/router'
 * await listRoutes()
 * ```
 */
export async function listRoutes(): Promise<Ok<string, any>> {
  const routeLists = await route.getRoutes()

  if (routeLists.length === 0) {
    log.info('No routes registered')
    return ok('No routes registered')
  }

  // Format routes for table display
  const formattedRoutes = routeLists.map(r => ({
    Method: r.method,
    URI: r.uri,
    Name: r.name || '-',
    Middleware: r.middleware?.length ? `[${r.middleware.length}]` : '-',
  }))

  // eslint-disable-next-line no-console
  console.table(formattedRoutes)

  return ok('Successfully listed routes!')
}

/**
 * Extract model name from an ORM action path
 *
 * @example
 * ```ts
 * extractModelFromAction('/UserIndexOrmAction') // 'User'
 * extractModelFromAction('/PostStoreOrmAction') // 'Post'
 * ```
 */
export function extractModelFromAction(action: string): string {
  // Match patterns like UserIndexOrmAction, PostStoreOrmAction, etc.
  const patterns = [
    /\/([A-Z][a-z]+)IndexOrmAction/,
    /\/([A-Z][a-z]+)StoreOrmAction/,
    /\/([A-Z][a-z]+)ShowOrmAction/,
    /\/([A-Z][a-z]+)UpdateOrmAction/,
    /\/([A-Z][a-z]+)DestroyOrmAction/,
  ]

  for (const pattern of patterns) {
    const match = action.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return ''
}

/**
 * Extract action name from an Actions path
 *
 * @example
 * ```ts
 * extractDynamicAction('Actions/CreateUserAction') // 'CreateUser'
 * ```
 */
export function extractDynamicAction(action: string): string | undefined {
  const regex = /Actions\/(.*?)Action/
  const match = action.match(regex)
  return match ? match[1] : ''
}

/**
 * Extract and load the model request instance for an ORM action
 */
export async function extractModelRequest(action: string): Promise<RequestInstance | null> {
  try {
    const extractedModel = extractModelFromAction(action)
    if (!extractedModel) {
      return null
    }

    const lowerCaseModel = camelCase(extractedModel)
    const requestPath = path.frameworkPath(`requests/${extractedModel}Request.ts`)
    const requestInstance = await import(requestPath)
    const requestIndex = `${lowerCaseModel}Request`

    return requestInstance[requestIndex]
  }
  catch (error) {
    log.debug(`Could not extract model request for action: ${action}`, error)
    return null
  }
}

/**
 * Find and load the request instance for a given model
 */
export async function findRequestInstanceFromAction(model: string): Promise<ModelRequest> {
  const requestPath = path.frameworkPath(`requests/${model}Request.ts`)
  const requestInstance = await import(requestPath)
  const requestIndex = `${camelCase(model)}Request`
  return requestInstance[requestIndex]
}

/**
 * Get the action name from a file path
 *
 * @example
 * ```ts
 * getActionName('/app/Actions/CreateUserAction.ts') // 'CreateUserAction'
 * ```
 */
export function getActionName(actionPath: string): string {
  const baseName = path.basename(actionPath)
  return baseName.replace(/\.ts$/, '')
}

/**
 * Extract model name from an action class name
 *
 * @example
 * ```ts
 * getModelFromAction('UserStoreOrmAction') // 'User'
 * getModelFromAction('PostIndexAction') // 'Post'
 * ```
 */
export function getModelFromAction(action: string): string {
  const actionName = getActionName(action)

  const modelName = actionName
    .replace(/Action$/, '')
    .replace(/Orm$/, '')
    .replace(/(Store|Update|Edit|Index|Show|Destroy|Create|Delete)/g, '')
    .replace(/\s+/g, '')
    .trim()

  return modelName
}

/**
 * Extract and load the default request instance
 */
export async function extractDefaultRequest(): Promise<RequestInstance> {
  const requestPath = path.frameworkPath('core/router/src/request.ts')
  const requestInstance = await import(requestPath)
  return requestInstance.request
}

// ============================================================================
// ROUTE URL GENERATION
// ============================================================================

/**
 * Generate a URL for a named route
 *
 * @example
 * ```ts
 * generateRouteUrl('users.show', { id: '123' }) // '/users/123'
 * ```
 */
export function generateRouteUrl(name: string, params?: Record<string, string | number>): string {
  return route.route(name, params)
}

/**
 * Check if a route with the given name exists
 */
export async function routeExists(name: string): Promise<boolean> {
  const routes = await route.getRoutes()
  return routes.some(r => r.name === name)
}

/**
 * Find a route by its name
 */
export async function findRouteByName(name: string): Promise<StacksRoute | undefined> {
  const routes = await route.getRoutes()
  return routes.find(r => r.name === name)
}

/**
 * Find routes by HTTP method
 */
export async function findRoutesByMethod(method: string): Promise<StacksRoute[]> {
  const routes = await route.getRoutes()
  return routes.filter(r => r.method.toUpperCase() === method.toUpperCase())
}

/**
 * Find routes by path pattern
 */
export async function findRoutesByPath(pattern: string | RegExp): Promise<StacksRoute[]> {
  const routes = await route.getRoutes()

  if (typeof pattern === 'string') {
    return routes.filter(r => r.uri.includes(pattern))
  }

  return routes.filter(r => pattern.test(r.uri))
}

// ============================================================================
// ROUTE DEBUGGING
// ============================================================================

/**
 * Get route statistics
 */
export async function getRouteStats(): Promise<{
  total: number
  byMethod: Record<string, number>
  withMiddleware: number
  withoutMiddleware: number
}> {
  const routes = await route.getRoutes()

  const byMethod: Record<string, number> = {}
  let withMiddleware = 0
  let withoutMiddleware = 0

  for (const r of routes) {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1
    if (r.middleware && r.middleware.length > 0) {
      withMiddleware++
    }
    else {
      withoutMiddleware++
    }
  }

  return {
    total: routes.length,
    byMethod,
    withMiddleware,
    withoutMiddleware,
  }
}

/**
 * Print route statistics to console
 */
export async function printRouteStats(): Promise<void> {
  const stats = await getRouteStats()

  log.info('Route Statistics:')
  log.info(`  Total routes: ${stats.total}`)
  log.info('  By method:')
  for (const [method, count] of Object.entries(stats.byMethod)) {
    log.info(`    ${method}: ${count}`)
  }
  log.info(`  With middleware: ${stats.withMiddleware}`)
  log.info(`  Without middleware: ${stats.withoutMiddleware}`)
}

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Normalize a route path
 */
export function normalizePath(routePath: string): string {
  // Remove trailing slash
  let normalized = routePath.endsWith('/') ? routePath.slice(0, -1) : routePath

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }

  return normalized
}

/**
 * Join path segments into a route path
 */
export function joinPaths(...segments: string[]): string {
  const joined = segments
    .map(s => s.replace(/^\/+|\/+$/g, ''))
    .filter(s => s.length > 0)
    .join('/')

  return `/${joined}`
}

/**
 * Extract path parameters from a route pattern
 *
 * @example
 * ```ts
 * extractPathParams('/users/{id}/posts/{postId}') // ['id', 'postId']
 * ```
 */
export function extractPathParams(routePath: string): string[] {
  const matches = routePath.match(/\{(\w+)\}/g) || []
  return matches.map(m => m.slice(1, -1))
}

/**
 * Check if a route path has parameters
 */
export function hasPathParams(routePath: string): boolean {
  return /\{(\w+)\}/.test(routePath)
}

/**
 * Replace path parameters with values
 *
 * @example
 * ```ts
 * replacePathParams('/users/{id}', { id: '123' }) // '/users/123'
 * ```
 */
export function replacePathParams(
  routePath: string,
  params: Record<string, string | number>,
): string {
  let result = routePath

  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value))
  }

  return result
}
