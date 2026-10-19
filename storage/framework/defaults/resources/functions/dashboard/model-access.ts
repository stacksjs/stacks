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
  const Model = (injected && typeof injected.where === 'function') ? injected : (candidate ?? await loadModelIfExists(name))
  return Model && hasDashboardModelAccess(Model) ? Model : null
}
