/**
 * The HQ services an application can connect to.
 *
 * They are separate products. Each keeps its own account, keys, plan and
 * subscription, so every service here carries its own credentials and nothing
 * is shared between them.
 */
export type HqServiceName = 'bughq' | 'loghq' | 'analyticshq' | 'statushq' | 'commshq'

export interface HqServiceOptions {
  /** The service's origin, e.g. `https://loghq.org`. */
  url: string
  /** The key the app's SDK writes with. */
  key?: string
  /** The key the app's own dashboard and `buddy hq:status` read with. Server-side only. */
  readKey?: string
  /** The id of the project (or site) the keys were issued for. */
  project?: string
}

/**
 * One entry per service, written by `buddy hq:connect`.
 *
 * `config/logging.ts` and `config/monitoring.ts` fall back to the `loghq` and
 * `bughq` entries, and the dashboard's `hq` provider reads with their read
 * keys.
 */
export type HqOptions = Record<HqServiceName, HqServiceOptions>

export type HqConfig = Partial<HqOptions>
