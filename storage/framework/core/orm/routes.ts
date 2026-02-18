/**
 * ORM-generated routes
 *
 * Auto-generates CRUD REST API routes based on model `useApi` trait definitions.
 * User-defined routes in ./routes/ are loaded first and always take priority.
 */

import type { EnhancedRequest } from '@stacksjs/bun-router'
import { route } from '@stacksjs/router'
import { projectPath } from '@stacksjs/path'
import { setConfig, createQueryBuilder } from '@stacksjs/query-builder'

// Initialize query builder config from project's config/qb.ts
const qbConfigPath = projectPath('config/qb.ts')
const qbConfig = (await import(qbConfigPath)).default
setConfig(qbConfig)

// Load all models from app/Models/ (individually, so one broken model doesn't block the rest)
const modelsDir = projectPath('app/Models')
const models: Record<string, any> = {}

try {
  const { readdirSync, statSync } = await import('node:fs')
  const { extname, basename } = await import('node:path')

  const entries = readdirSync(modelsDir)
  for (const entry of entries) {
    const full = `${modelsDir}/${entry}`
    const st = statSync(full)
    if (st.isDirectory()) continue
    const ext = extname(full)
    if (!['.ts', '.js'].includes(ext)) continue

    try {
      const mod = await import(`${full}?t=${Date.now()}`)
      const def = mod.default ?? mod
      const name = def.name ?? basename(entry, ext)
      models[name] = { ...def, name }
    }
    catch {
      // Skip models that fail to import (e.g., missing dependencies)
    }
  }
}
catch {
  // Models directory may not exist yet
}

// Create a query builder instance (uses the config set above)
const db = createQueryBuilder()

// Helper: check if a route is already registered (user-defined routes take priority)
function routeExists(method: string, path: string): boolean {
  return route.routes.some(
    (r: any) => r.method === method && r.path === path,
  )
}

// Helper: get fillable attribute names from a model
function getFillableFields(model: any): string[] {
  if (!model.attributes) return []
  return Object.entries(model.attributes)
    .filter(([_, attr]: [string, any]) => attr.fillable === true)
    .map(([name]: [string, any]) => name)
}

// Helper: get hidden attribute names from a model
function getHiddenFields(model: any): string[] {
  if (!model.attributes) return []
  return Object.entries(model.attributes)
    .filter(([_, attr]: [string, any]) => attr.hidden === true)
    .map(([name]: [string, any]) => name)
}

// Helper: strip hidden fields from a record
function stripHidden(record: any, hiddenFields: string[]): any {
  if (!record || hiddenFields.length === 0) return record
  const result = { ...record }
  for (const field of hiddenFields) {
    delete result[field]
  }
  return result
}

// Helper: filter request body to only fillable fields
function filterFillable(body: any, fillableFields: string[]): Record<string, any> {
  if (!body || fillableFields.length === 0) return {}
  const result: Record<string, any> = {}
  for (const field of fillableFields) {
    if (field in body) {
      result[field] = body[field]
    }
  }
  return result
}

// Helper: create JSON response (avoids bun-router's monkey-patched Response.json)
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Register CRUD routes for each model with useApi trait
for (const [modelName, model] of Object.entries(models)) {
  const useApi = model.traits?.useApi
  if (!useApi) continue

  // useApi can be `true` (auto-derive uri from table) or an object with { uri, routes }
  const apiConfig = typeof useApi === 'object' ? useApi : {}
  const uri = apiConfig.uri || model.table || modelName.toLowerCase() + 's'

  const enabledRoutes: string[] = apiConfig.routes || ['index', 'show', 'store', 'update', 'destroy']
  const table = model.table || uri
  const fillableFields = getFillableFields(model)
  const hiddenFields = getHiddenFields(model)
  const basePath = `/api/${uri}`

  // GET /api/{uri} — list all records (paginated)
  if (enabledRoutes.includes('index') && !routeExists('GET', basePath)) {
    route.get(basePath, async (req: EnhancedRequest) => {
      try {
        const url = new URL(req.url)
        const page = Number.parseInt(url.searchParams.get('page') || '1', 10)
        const perPage = Number.parseInt(url.searchParams.get('per_page') || '25', 10)
        const offset = (page - 1) * perPage

        const results = await (db as any).selectFrom(table).limit(perPage).offset(offset).get()
        const records = (results || []).map((r: any) => stripHidden(r, hiddenFields))

        return jsonResponse({
          data: records,
          meta: { page, per_page: perPage },
        })
      }
      catch (err) {
        return jsonResponse({ error: `Failed to fetch ${uri}`, detail: String(err) }, 500)
      }
    })
  }

  // GET /api/{uri}/{id} — show single record
  if (enabledRoutes.includes('show') && !routeExists('GET', `${basePath}/{id}`)) {
    route.get(`${basePath}/{id}`, async (req: EnhancedRequest) => {
      try {
        const id = (req as any).params?.id
        const result = await (db as any).selectFrom(table).where({ id }).executeTakeFirst()

        if (!result) {
          return jsonResponse({ error: `${modelName} not found` }, 404)
        }

        return jsonResponse({ data: stripHidden(result, hiddenFields) })
      }
      catch (err) {
        return jsonResponse({ error: `Failed to fetch ${modelName}`, detail: String(err) }, 500)
      }
    })
  }

  // POST /api/{uri} — create record
  if (enabledRoutes.includes('store') && !routeExists('POST', basePath)) {
    route.post(basePath, async (req: EnhancedRequest) => {
      try {
        const body = await req.clone().json().catch(() => ({}))
        const data = filterFillable(body, fillableFields)

        if (Object.keys(data).length === 0) {
          return jsonResponse({ error: 'No fillable fields provided' }, 422)
        }

        // Add timestamps if model uses them
        if (model.traits?.useTimestamps !== false) {
          const now = new Date().toISOString()
          data.created_at = now
          data.updated_at = now
        }

        await (db as any).insertInto(table).values(data).execute()

        return jsonResponse({ data: stripHidden(data, hiddenFields) }, 201)
      }
      catch (err) {
        return jsonResponse({ error: `Failed to create ${modelName}`, detail: String(err) }, 500)
      }
    })
  }

  // PUT /api/{uri}/{id} — update record
  if (enabledRoutes.includes('update') && !routeExists('PUT', `${basePath}/{id}`)) {
    route.put(`${basePath}/{id}`, async (req: EnhancedRequest) => {
      try {
        const id = (req as any).params?.id
        const body = await req.clone().json().catch(() => ({}))
        const data = filterFillable(body, fillableFields)

        if (Object.keys(data).length === 0) {
          return jsonResponse({ error: 'No fillable fields provided' }, 422)
        }

        // Add updated_at timestamp
        if (model.traits?.useTimestamps !== false) {
          data.updated_at = new Date().toISOString()
        }

        await (db as any).updateTable(table).set(data).where({ id }).execute()

        return jsonResponse({ data: { id, ...stripHidden(data, hiddenFields) } })
      }
      catch (err) {
        return jsonResponse({ error: `Failed to update ${modelName}`, detail: String(err) }, 500)
      }
    })
  }

  // DELETE /api/{uri}/{id} — delete record
  if (enabledRoutes.includes('destroy') && !routeExists('DELETE', `${basePath}/{id}`)) {
    route.delete(`${basePath}/{id}`, async (req: EnhancedRequest) => {
      try {
        const id = (req as any).params?.id
        await (db as any).deleteFrom(table).where({ id }).execute()

        return new Response(null, { status: 204 })
      }
      catch (err) {
        return jsonResponse({ error: `Failed to delete ${modelName}`, detail: String(err) }, 500)
      }
    })
  }
}

export default route
