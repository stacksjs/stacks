/** Server-side exposure boundary for the generic dashboard model surfaces. */
import type { DashboardModelOptions } from '@stacksjs/types'
import { loadModelIfExists } from './data'

/** Omission preserves the existing dashboard exposure. `enabled` only controls navigation. */
export function hasDashboardModelAccess(Model: { dashboard?: DashboardModelOptions } | null | undefined): boolean {
  return Model?.dashboard?.access !== false
}

/** Resolve the native model, then exclude it before callers inspect metadata or query rows. */
export async function resolveDashboardModel(name: string, candidate?: any): Promise<any | null> {
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
