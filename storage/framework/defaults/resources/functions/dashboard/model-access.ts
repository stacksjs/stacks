/** Server-side exposure boundary for the generic dashboard model surfaces. */
import type { DashboardModelOptions } from '@stacksjs/types'
import type { ModelSource } from '@stacksjs/database/model-sources'
import { listModelSources } from '@stacksjs/database/model-sources'
import { loadModelIfExists } from './data'

/** Omission preserves the existing dashboard exposure. `enabled` only controls navigation. */
export function hasDashboardModelAccess(Model: { dashboard?: DashboardModelOptions } | null | undefined): boolean {
  return Model?.dashboard?.access !== false
}

/**
 * The models in the app's schema, for {@link resolveDashboardModel}. Read
 * once by a caller that resolves many models and handed to each call, so a
 * page of 110 models lists the model directories once and not 110 times.
 */
export function dashboardModelSources(): ModelSource[] {
  return listModelSources() ?? []
}

/**
 * Resolve the native model, then exclude it before callers inspect metadata or query rows.
 *
 * `sources` is {@link dashboardModelSources}, from a caller that already has
 * it. Without it the directories are listed here: reads only. This used to
 * ask the migration generator's `resolveModelSources`, which rebuilds its
 * staging directory on every call, about 11ms of blocking file writes per
 * model resolved.
 */
export async function resolveDashboardModel(name: string, candidate?: any, sources: readonly ModelSource[] = dashboardModelSources()): Promise<any | null> {
  // App-owned definitions retain their native ORM and dashboard access even
  // when a same-named framework feature exports a disabled proxy.
  const source = sources.find(model => model.name === name)
  if (source && source.origin !== 'framework') {
    const Model = candidate ?? await loadModelIfExists(name)
    return Model && hasDashboardModelAccess(Model) ? Model : null
  }
  const injected = (globalThis as Record<string, any>)[name]
  // A model whose feature is off is still the ORM's export, as a proxy that
  // throws on `.where` (#2928). `in` asks it without the throw, and a feature
  // that is off keeps its models out of the dashboard as it does the sidebar.
  // Compared to the ORM's own export so a built-in global the ORM leaves in
  // place, like `Request`, still resolves through its model file.
  if (injected && injected === (await import('@stacksjs/orm') as Record<string, unknown>)[name] && !('where' in injected))
    return null
  const Model = (injected && typeof injected.where === 'function') ? injected : (candidate ?? await loadModelIfExists(name))
  return Model && hasDashboardModelAccess(Model) ? Model : null
}
