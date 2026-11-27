#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { overridesReady } from '@stacksjs/config'
import { dashboardViewExclusions, readDashboardPageAvailability } from '../../../../resources/functions/dashboard/page-availability'

interface ModelSummary {
  href: string
}

interface ModelIndex {
  categoryGroups?: Array<{ models?: ModelSummary[] }>
}

interface Failure {
  body?: string
  contentType?: string
  error?: string
  fragment?: string | null
  kind: string
  path: string
  status?: number
}

const projectRoot = resolve(process.cwd())
const args = process.argv.slice(2)
const baseUrlFlagIndex = args.indexOf('--base-url')
const baseUrlFlag = baseUrlFlagIndex >= 0
  ? args[baseUrlFlagIndex + 1]
  : args.find(arg => arg.startsWith('--base-url='))?.slice('--base-url='.length)
const positionalBaseUrl = args.find((arg, index) =>
  !arg.startsWith('-') && (baseUrlFlagIndex < 0 || index !== baseUrlFlagIndex + 1))
const baseUrl = (baseUrlFlag || positionalBaseUrl || process.env.DASHBOARD_URL || 'http://127.0.0.1:3002')
  .replace(/\/+$/, '')
const timeoutMs = 15_000
const failures: Failure[] = []

function files(directory: string): string[] {
  if (!existsSync(directory))
    return []

  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function dashboardDefaultsRoot(): string {
  const vendored = resolve(projectRoot, 'storage/framework/defaults')
  if (existsSync(join(vendored, 'views/dashboard')))
    return vendored

  return dirname(Bun.resolveSync('@stacksjs/defaults/package.json', projectRoot))
}

function viewRoute(root: string, path: string): string {
  const relativePath = relative(root, path).split(sep).join('/').replace(/\.stx$/, '')
  return relativePath === 'index'
    ? '/'
    : `/${relativePath.replace(/\/index$/, '')}`
}

function discoveredViewRoutes(): { dynamic: string[], static: string[], excluded: string[] } {
  const framework = join(dashboardDefaultsRoot(), 'views/dashboard')
  const app = resolve(projectRoot, 'resources/views/dashboard')
  const exclusions = dashboardViewExclusions(framework, readDashboardPageAvailability())
  const routes = new Map<string, boolean>()

  for (const root of [framework, app]) {
    for (const path of files(root)) {
      if (!path.endsWith('.stx') || relative(root, path).startsWith(`layouts${sep}`))
        continue
      const route = viewRoute(root, path)
      if (route !== '/[...all]')
        routes.set(route, !exclusions.some(excluded => path === excluded || path.startsWith(`${excluded}${sep}`)))
    }
  }

  const enabled = [...routes].filter(([, available]) => available).map(([route]) => route)
  return {
    dynamic: enabled.filter(route => route.includes('[')).sort(),
    static: enabled.filter(route => !route.includes('[')).sort(),
    excluded: [...routes].filter(([route, available]) => !available && !route.includes('[')).map(([route]) => route).sort(),
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function validatePageResponse(
  path: string,
  kind: string,
  response: Response,
): Promise<void> {
  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()

  if (!contentType.includes('text/html')) {
    failures.push({
      path,
      kind: `${kind}-content`,
      status: response.status,
      contentType,
    })
    return
  }
  if (!body.trim()) {
    failures.push({ path, kind: `${kind}-empty`, status: response.status })
    return
  }

  const renderedMarkup = body.replace(/<!--[\s\S]*?-->/g, '')
  const unresolved = renderedMarkup
    .match(/<\/?[A-Z][A-Za-z0-9]*(?:\s|>|\/>)/)?.[0]
  if (unresolved) {
    failures.push({
      path,
      kind: `${kind}-component`,
      status: response.status,
      body: unresolved,
    })
  }
}

async function auditPage(path: string): Promise<void> {
  try {
    const full = await request(path)
    if (full.status !== 200)
      failures.push({ path, kind: 'full-page', status: full.status })
    else
      await validatePageResponse(path, 'full-page', full)
  }
  catch (error) {
    failures.push({ path, kind: 'full-page', error: String(error) })
  }

  try {
    const fragment = await request(path, {
      headers: { 'X-STX-Router': 'true', Accept: 'text/html' },
    })
    const fragmentHeader = fragment.headers.get('x-stx-fragment')
    if (fragment.status !== 200 || fragmentHeader !== 'true') {
      failures.push({
        path,
        kind: 'stx-fragment',
        status: fragment.status,
        fragment: fragmentHeader,
      })
    }
    else {
      await validatePageResponse(path, 'stx-fragment', fragment)
    }
  }
  catch (error) {
    failures.push({ path, kind: 'stx-fragment', error: String(error) })
  }
}

async function json(path: string): Promise<Record<string, any>> {
  try {
    const response = await request(path)
    if (!response.ok)
      return {}
    return await response.json() as Record<string, any>
  }
  catch {
    return {}
  }
}

function firstId(payload: Record<string, any>, key: string): string | undefined {
  const item = Array.isArray(payload[key]) ? payload[key][0] : undefined
  return item?.id == null ? undefined : String(item.id)
}

async function discoverDynamicPages(
  templates: string[],
  modelRoutes: string[],
): Promise<string[]> {
  const [
    products,
    deployments,
    jobs,
    boards,
    queries,
    servers,
    teams,
  ] = await Promise.all([
    json('/api/dashboard/commerce/products'),
    json('/api/dashboard/deployments'),
    json('/api/dashboard/jobs'),
    json('/api/dashboard/kanban/boards'),
    json('/api/dashboard/queries'),
    json('/api/dashboard/servers'),
    json('/api/dashboard/data/teams'),
  ])

  const replacements: Record<string, string> = {
    '/commerce/products/[id]': firstId(products, 'products') || '1',
    '/deployments/[id]': firstId(deployments, 'deployments') || 'missing',
    '/jobs/[id]': firstId(jobs, 'data') || 'missing',
    '/kanban/[id]': firstId(boards, 'boards') || 'missing',
    '/queries/[id]': firstId(queries, 'queries') || 'missing',
    '/servers/[id]': firstId(servers, 'servers') || 'missing',
    '/team-invitations/[token]': 'missing',
    '/teams/[id]': firstId(teams, 'teams') || 'missing',
  }

  return templates
    .filter(template => template !== '/models/[model]')
    .map((template) => {
      const replacement = replacements[template] || 'missing'
      return template.replace(/\[[^\]]+\]/g, replacement)
    })
    .concat(modelRoutes)
}

function dashboardApiRoutes(): string[] {
  const path = join(dashboardDefaultsRoot(), 'routes/dashboard-api.ts')
  const source = readFileSync(path, 'utf8')
  return [...source.matchAll(/route\.get\(\s*['"]([^'"]+)['"]/g)]
    .map(match => `/api/dashboard${match[1]}`)
}

function concreteApiPath(
  path: string,
  dynamicPages: string[],
  modelRoutes: string[],
): string {
  const match = (prefix: string) => dynamicPages
    .find(route => route.startsWith(`${prefix}/`))
    ?.slice(prefix.length + 1)

  if (path === '/api/dashboard/models/{slug}')
    return `/api/dashboard/models/${modelRoutes[0]?.split('/').pop() || 'activity'}`
  if (path === '/api/dashboard/servers/{id}')
    return `/api/dashboard/servers/${match('/servers') || 'missing'}`
  if (path === '/api/dashboard/jobs/{id}')
    return `/api/dashboard/jobs/${match('/jobs') || 'missing'}`
  if (path === '/api/dashboard/commerce/products/{id}')
    return `/api/dashboard/commerce/products/${match('/commerce/products') || '1'}`
  if (path === '/api/dashboard/teams/{id}/people')
    return `/api/dashboard/teams/${match('/teams') || '1'}/people`
  if (path === '/api/dashboard/kanban/boards/{id}')
    return `/api/dashboard/kanban/boards/${match('/kanban') || '1'}`
  if (path === '/api/dashboard/queries/{id}')
    return `/api/dashboard/queries/${match('/queries') || '1'}`

  return path
    .replace('{owner}', 'stacksjs')
    .replace('{name}', 'stacks')
    .replace('{runId}', '1')
    .replace('{slug}', 'missing-post')
    .replace('{id}', '1')
}

async function auditApi(
  routes: string[],
  dynamicPages: string[],
  modelRoutes: string[],
): Promise<Record<number, number>> {
  const statuses: Record<number, number> = {}

  for (const route of routes) {
    const path = concreteApiPath(route, dynamicPages, modelRoutes)

    try {
      const response = await request(path)
      const status = response.status
      const contentType = response.headers.get('content-type') || ''
      const body = await response.text()
      statuses[status] = (statuses[status] || 0) + 1

      if (status >= 500 || status === 405) {
        failures.push({
          path,
          kind: 'api-status',
          status,
          body: body.slice(0, 160),
        })
        continue
      }
      if (contentType.includes('text/html')) {
        failures.push({ path, kind: 'api-content', status, contentType })
        continue
      }
      if (status !== 200 || !contentType.includes('json'))
        continue

      try {
        const payload = JSON.parse(body)
        if (
          payload
          && typeof payload === 'object'
          && (
            payload.ok === false
            || payload.success === false
            || typeof payload.error === 'string'
          )
        ) {
          failures.push({
            path,
            kind: 'api-hidden-error',
            status,
            body: body.slice(0, 160),
          })
        }
      }
      catch {
        failures.push({ path, kind: 'api-json', status, error: 'Invalid JSON' })
      }
    }
    catch (error) {
      failures.push({ path, kind: 'api-request', error: String(error) })
    }
  }

  return statuses
}

await overridesReady
const views = discoveredViewRoutes()
if (views.static.length === 0) {
  failures.push({
    path: projectRoot,
    kind: 'static-route-discovery',
    error: 'No dashboard route views were discovered',
  })
}
const modelIndex = await json('/api/dashboard/models') as ModelIndex
const modelRoutes = (modelIndex.categoryGroups || [])
  .flatMap(group => group.models || [])
  .map(model => model.href)
  .filter(Boolean)
if (!Array.isArray(modelIndex.categoryGroups)) {
  failures.push({
    path: '/api/dashboard/models',
    kind: 'model-route-discovery',
    error: 'The model index did not return category groups',
  })
}
const dynamicPages = await discoverDynamicPages(views.dynamic, modelRoutes)

for (const path of views.static)
  await auditPage(path)
for (const path of dynamicPages)
  await auditPage(path)
for (const path of views.excluded) {
  try {
    const response = await request(path, { redirect: 'manual' })
    await response.body?.cancel()
    if (response.status !== 404)
      failures.push({ path, kind: 'excluded-page', status: response.status })
  }
  catch (error) {
    failures.push({ path, kind: 'excluded-page', error: String(error) })
  }
}

const apiRoutes = dashboardApiRoutes()
if (apiRoutes.length === 0) {
  failures.push({
    path: '/api/dashboard',
    kind: 'api-route-discovery',
    error: 'No GET dashboard API routes were discovered',
  })
}
const statuses = await auditApi(apiRoutes, dynamicPages, modelRoutes)
const remainingDynamicCount = dynamicPages.length - modelRoutes.length

console.log(JSON.stringify({
  baseUrl,
  pages: {
    excluded: views.excluded.length,
    static: { routes: views.static.length, requests: views.static.length * 2 },
    models: { routes: modelRoutes.length, requests: modelRoutes.length * 2 },
    dynamic: {
      routes: remainingDynamicCount,
      requests: remainingDynamicCount * 2,
    },
  },
  api: { routes: apiRoutes.length, statuses },
  failures,
}, null, 2))

if (failures.length > 0)
  process.exitCode = 1
