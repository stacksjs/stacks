import type { ModelSource } from './model-sources'
import { existsSync, readFileSync } from 'node:fs'
import { path } from '@stacksjs/path'
import { getLiveTables } from './fk-audit'
import { declaredTableName, excludedFrameworkModels } from './model-sources'

/**
 * Model names never installed as server globals, because they would shadow a
 * JavaScript builtin. A bare `Error` in an action is the builtin, so it says
 * nothing about the `Error` model. Mirrors the blocklist in
 * `@stacksjs/server`'s auto-import generator.
 */
const BUILTIN_NAMES = new Set(['Error', 'Request', 'Response', 'URL', 'Map', 'Set', 'Object', 'Array', 'Number', 'String', 'Date', 'Promise', 'Symbol'])

/** How long boot waits for the table list before registering everything. */
const LIVE_TABLES_TIMEOUT_MS = 3000

interface MissingModel {
  name: string
  table: string
}

/**
 * Decide, per framework default route, whether its action can work in this app.
 *
 * `database.models.includeFrameworkDefaults: false` takes the framework's
 * models out of an app's schema, and the default route bundles went on
 * registering actions that query them. `POST /api/email/subscribe` reads
 * `Subscriber`, so in an app without a `subscribers` table it answered 500 with
 * nothing at boot, build or migrate saying why (stacksjs/stacks#2943).
 *
 * A route is withheld only when both are true: the model is out of the schema,
 * AND the live database has no table for it. Schema alone is not enough, because
 * an app that created those tables before #2220 still has them, and its routes
 * work. When the table list cannot be read, nothing is withheld and the routes
 * register exactly as they did before.
 *
 * The dependency is read from the framework action's own source: a model it
 * imports from `@stacksjs/orm` or names as a global, or a missing table it names
 * in quotes. An action the app overrides in `app/Actions` is the app's, and is
 * always admitted.
 */
export async function frameworkRouteAdmission(options: {
  excluded?: ModelSource[]
  liveTables?: () => Promise<Set<string>>
  appActionsRoot?: string
  frameworkActionsRoot?: string
} = {}): Promise<((handler: string) => string | undefined) | undefined> {
  const excluded = options.excluded ?? excludedFrameworkModels()
  if (excluded.length === 0)
    return undefined

  const live = await withTimeout((options.liveTables ?? getLiveTables)(), LIVE_TABLES_TIMEOUT_MS).catch(() => undefined)
  if (!live || live.size === 0)
    return undefined

  const missing: MissingModel[] = excluded
    .map(model => ({ name: model.name, table: declaredTableName(model).toLowerCase() }))
    .filter(model => !live.has(model.table))
  if (missing.length === 0)
    return undefined

  const appActionsRoot = options.appActionsRoot ?? path.appPath('Actions')
  const frameworkActionsRoot = options.frameworkActionsRoot ?? path.frameworkPath('defaults/app/Actions')
  const transpiler = new Bun.Transpiler({ loader: 'ts', trimUnusedImports: false })
  const verdicts = new Map<string, string | undefined>()

  return (handler: string): string | undefined => {
    if (verdicts.has(handler))
      return verdicts.get(handler)

    const verdict = judge(handler)
    verdicts.set(handler, verdict)
    return verdict
  }

  function judge(handler: string): string | undefined {
    if (!handler.startsWith('Actions/'))
      return undefined

    const relative = handler.slice('Actions/'.length).replace(/\.ts$/, '')
    if (existsSync(`${appActionsRoot}/${relative}.ts`))
      return undefined

    const file = `${frameworkActionsRoot}/${relative}.ts`
    let code: string
    try {
      code = transpiler.transformSync(readFileSync(file, 'utf8'))
    }
    catch {
      return undefined
    }

    const fromOrm = ormImports(code)
    const needs = missing.filter(model =>
      fromOrm.has(model.name)
      || (!BUILTIN_NAMES.has(model.name) && new RegExp(`\\b${model.name}\\b`).test(code))
      || new RegExp(`['"\`]${escapeRegExp(model.table)}['"\`]`).test(code),
    )
    if (needs.length === 0)
      return undefined

    return needs.map(model => `${model.name} (table "${model.table}" does not exist)`).join(', ')
  }
}

/** Names an action imports from `@stacksjs/orm` or one of its subpaths. */
function ormImports(code: string): Set<string> {
  const names = new Set<string>()
  for (const match of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@stacksjs\/orm(?:\/[^"']*)?["']/g)) {
    for (const specifier of (match[1] ?? '').split(',')) {
      const name = specifier.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim()
      if (name)
        names.add(name)
    }
  }
  return names
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let cancel = (): void => {}
  const timeout = new Promise<undefined>((resolve) => {
    const timer = setTimeout(resolve, ms)
    cancel = () => clearTimeout(timer)
  })
  return Promise.race([promise, timeout]).finally(() => cancel())
}
