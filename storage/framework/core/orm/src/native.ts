import { Database } from 'bun:sqlite'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { buildMigrationPlan, configureOrm, generateDiffOperations, setConfig } from '@stacksjs/query-builder'
import type { MigrationPlan } from '@stacksjs/query-builder'
import { apiBasePath, filterFillable, getWritableFields, mapWriteError, resolveIndexPageArgs } from './auto-crud'
import { MODEL_DEFINITION, toAttrs } from './define-model'
import type { StacksModelDefinition } from './define-model'

/** Explicit model registry: the compiled app never discovers source files at runtime. */
export interface NativeModel {
  [MODEL_DEFINITION]: StacksModelDefinition
  find: (id: number) => Promise<unknown>
  create: (data: Record<string, unknown>) => Promise<unknown>
  update: (id: number, data: Record<string, unknown>) => Promise<unknown>
  destroy: (id: number) => Promise<unknown>
  limit: (count: number) => { offset: (offset: number) => { get: () => Promise<unknown> } }
}

/**
 * Own one SQLite database in a native backend process. Schema comes from the
 * same migration planner as Buddy; additive upgrades and the snapshot commit
 * atomically. Destructive upgrades require an explicit application migration.
 */
export function openNativeDatabase(options: { path: string, models: Record<string, NativeModel> }): Database {
  if (options.path !== ':memory:' && !isAbsolute(options.path))
    throw new Error('A native database requires an absolute Application Support path')
  if (options.path !== ':memory:') mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 })
  const db = new Database(options.path, { create: true })
  try {
    // Native helpers reserve stdout for their readiness handshake. Use the
    // query builder's quiet mode before deriving or applying schema changes.
    setConfig({ verbose: false })
    if (options.path !== ':memory:') chmodSync(options.path, 0o600)
    // SQLite rebuilds must disable FK actions before BEGIN, then verify all
    // references before committing. The connection is not exposed until done.
    db.exec('PRAGMA foreign_keys = OFF; PRAGMA busy_timeout = 5000;')
    const models = Object.fromEntries(Object.entries(options.models).map(([name, model]) => [name, model[MODEL_DEFINITION]]))
    const next = buildMigrationPlan(models, { dialect: 'sqlite' })
    db.transaction(() => {
      db.exec('CREATE TABLE IF NOT EXISTS _stacks_native_schema (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL)')
      const saved = db.query('SELECT snapshot FROM _stacks_native_schema WHERE id = 1').get() as { snapshot: string } | null
      const previous = saved ? JSON.parse(saved.snapshot) as MigrationPlan : undefined
      const diff = generateDiffOperations(previous, next, { externalTransaction: true })
      if (diff.operations.some(operation => operation.destructive))
        throw new Error('Native model upgrade contains destructive changes; provide an explicit data migration')
      for (const statement of diff.statements) {
        if (statement.replace(/--[^\n]*/g, '').trim()) db.exec(statement)
      }
      if (db.query('PRAGMA foreign_key_check').all().length)
        throw new Error('Native model upgrade violates foreign-key constraints')
      db.query('INSERT INTO _stacks_native_schema (id, snapshot) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET snapshot = excluded.snapshot').run(JSON.stringify(next))
    }).immediate()
    db.exec('PRAGMA foreign_keys = ON;')
    configureOrm({ database: db })
    return db
  }
  catch (error) { db.close(); throw error }
}

/**
 * Model-declared CRUD for an authenticated native transport. Authorization is
 * mandatory and evaluated before queries; web middleware is never bypassed.
 * Use only behind stx's authenticated native backend, or supply an equivalent
 * per-request authorization implementation. Native models explicitly declare
 * middleware: [] because their session is enforced by this transport.
 */
export function createNativeModelApi(options: {
  models: Record<string, NativeModel>
  authorize: (request: Request, model: string, ability: string) => boolean | Promise<boolean>
}): (request: Request) => Promise<Response | null> {
  const models = Object.entries(options.models).flatMap(([name, model]) => {
    const definition = model[MODEL_DEFINITION]
    const api = definition.traits?.useApi
    if (!api || typeof api !== 'object') return []
    if (!Array.isArray(api.middleware) || api.middleware.length)
      throw new Error(`${name}: native CRUD requires explicit middleware: [] and transport authorization`)
    if (!api.uri) throw new Error(`${name}: native CRUD requires a useApi uri`)
    return [{ name, model, definition, api, base: apiBasePath(api.uri, api.prefix) }]
  })
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'private, no-store' } })
  return async (request) => {
    const url = new URL(request.url)
    for (const entry of models) {
      const { name, model, definition, api, base } = entry
      const suffix = url.pathname.slice(base.length)
      if (!url.pathname.startsWith(base) || (suffix && !/^\/\d+$/.test(suffix))) continue
      const id = suffix ? Number(suffix.slice(1)) : undefined
      const ability = request.method === 'GET' ? (id === undefined ? 'index' : 'show')
        : request.method === 'POST' && id === undefined ? 'store'
          : ['PATCH', 'PUT'].includes(request.method) && id !== undefined ? 'update'
            : request.method === 'DELETE' && id !== undefined ? 'destroy' : undefined
      if (!ability || !api.routes?.includes(ability)) return json({ error: 'Method not allowed' }, 405)
      if (!await options.authorize(request, name, ability)) return json({ error: 'Forbidden' }, 403)
      try {
        if (ability === 'index') {
          const { perPage, offset } = resolveIndexPageArgs(url.searchParams)
          return json({ data: toAttrs(await model.limit(perPage).offset(offset).get()) })
        }
        if (id !== undefined && !await model.find(id)) return json({ error: 'Not found' }, 404)
        if (ability === 'show') return json({ data: toAttrs(await model.find(id!)) })
        if (ability === 'destroy') { await model.destroy(id!); return new Response(null, { status: 204 }) }
        let body: unknown
        try { body = await request.json() }
        catch { return json({ error: 'Invalid JSON' }, 400) }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Expected an object' }, 422)
        const fields = getWritableFields({ attributes: definition.attributes, belongsTo: Object.values(definition.belongsTo ?? {}) })
        const data = filterFillable(body as Record<string, unknown>, fields)
        const row = ability === 'store' ? await model.create(data) : await model.update(id!, data)
        return json({ data: toAttrs(row) }, ability === 'store' ? 201 : 200)
      }
      catch (error) {
        const result = mapWriteError(error, name, ability === 'store' ? 'create' : 'update')
        // Driver details belong in local diagnostics, never response bodies.
        const body = { ...result.body }
        delete body.detail
        return json(body, result.status)
      }
    }
    return null
  }
}
