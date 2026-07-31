import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface DashboardRoute {
  action: string
  method: string
  path: string
}

const dashboardRouteSource = readFileSync(
  resolve('storage/framework/defaults/routes/dashboard-api.ts'),
  'utf8',
)

function dashboardRoutes(): DashboardRoute[] {
  return [...dashboardRouteSource.matchAll(
    /route\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/g,
  )].map(match => ({
    method: match[1].toUpperCase(),
    path: `/api/dashboard${match[2]}`,
    action: match[3],
  }))
}

function sourceFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const file = join(path, entry)
    if (statSync(file).isDirectory())
      return sourceFiles(file)
    return /\.(?:stx|ts)$/.test(entry) ? [file] : []
  })
}

function clientDashboardPaths(): Array<{ file: string, path: string }> {
  const roots = [
    'storage/framework/defaults/functions',
    'storage/framework/defaults/resources/components/Dashboard',
    'storage/framework/defaults/resources/views/dashboard',
  ]

  return roots.flatMap(root => sourceFiles(root).flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/(['"`])(\/api\/dashboard[^'"`\s]*)\1/g)]
      .map(match => ({ file, path: match[2].split('?')[0] }))
  }))
}

function pathsCanMatch(clientPath: string, routePath: string): boolean {
  const normalizedClientPath = clientPath
    .replace(/\$\{(?:query|suffix)\}$/, '')
    .replace(/\/+$/, '')
  const clientSegments = normalizedClientPath.split('/')
  const routeSegments = routePath.split('/')

  return clientSegments.length === routeSegments.length
    && clientSegments.every((segment, index) => {
      const routeSegment = routeSegments[index]
      return segment === routeSegment
        || segment.includes('${')
        || /^\{[^}]+\}$/.test(routeSegment)
    })
}

describe('dashboard API route coverage', () => {
  test('registers each method and path exactly once', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []

    for (const route of dashboardRoutes()) {
      const signature = `${route.method} ${route.path}`
      if (seen.has(signature))
        duplicates.push(signature)
      seen.add(signature)
    }

    expect(duplicates).toEqual([])
  })

  test('resolves every registered route action to application source', () => {
    const routes = dashboardRoutes()
    const missing = routes
      .filter(({ action }) => {
        const relativePath = `${action}.ts`
        return !existsSync(resolve('app', relativePath))
          && !existsSync(resolve('storage/framework/defaults/app', relativePath))
      })
      .map(route => `${route.method} ${route.path} -> ${route.action}`)

    expect(routes.length).toBeGreaterThan(250)
    expect(missing).toEqual([])
  })

  test('backs every dashboard client URL with a registered route', () => {
    const routes = dashboardRoutes()
    const clientPaths = clientDashboardPaths()
    const missing = clientPaths
      .filter(client => !routes.some(route => pathsCanMatch(client.path, route.path)))
      .map(client => `${client.path} (${client.file})`)

    expect(clientPaths.length).toBeGreaterThan(200)
    expect(missing).toEqual([])
  })
})
