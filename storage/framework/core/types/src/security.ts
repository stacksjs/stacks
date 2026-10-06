import type { CountryCode } from './cloud'
import type { DeepPartial } from './utils'

export interface FirewallOptions {
  enabled: boolean // default: true
  countryCodes: CountryCode[]
  ipAddresses: string[]
  queryString: string[]
  httpHeaders: string[]
  // ipSets: string[]
  rateLimitPerMinute: number
  useIpReputationLists: boolean
  useKnownBadInputsRuleSet: boolean
}
export type FirewallConfig = Partial<FirewallOptions>

/**
 * **Row scoping for generated API routes**
 *
 * A model's `useApi` trait generates `store` / `update` / `destroy` routes.
 * Whether those routes are scoped to a row the caller owns is decided by the
 * model: an explicit `ownership` config, or a `team_id` column, which is
 * auto-scoped to the caller's active team. A model that declares neither gets
 * routes with no row-level check - correct for a public catalog table, and a
 * footgun everywhere else, because declaring nothing is what a model does by
 * accident as well as on purpose.
 *
 * - `'deny'` (the default) does not register mutating routes for a model that
 *   has neither an ownership config nor a declared `ownership: false`. A model
 *   restores its writes by saying who owns a row, or by saying in as many words
 *   that nothing does.
 * - `'warn'` registers those routes and names the models at boot. This was the
 *   default through 0.74.x, and is the escape hatch for an app that needs the
 *   old posture while it works through its models.
 *
 * The default flipped to `'deny'` in stacksjs/stacks#2375: 62 of the
 * framework's own 82 `useApi` models generated store/update/destroy that any
 * authenticated caller could point at any row, because declaring nothing is
 * what a model does by accident as well as on purpose. Failing closed makes
 * the accident visible instead of shipping it.
 */
export type ApiRowScopingPolicy = 'warn' | 'deny'

/**
 * Which models publish the REST API their `useApi` trait describes.
 *
 * - `'all'` (the default) - every `useApi` model, the framework's own included.
 * - `'own'` - only the app's models in `app/Models`, overrides included.
 * - `'none'` - no generated model APIs.
 * - a list of model names - exactly those; `'own'` may be one of them, to mean
 *   the app's models plus the named framework ones.
 *
 * `STACKS_MODEL_APIS` overrides it (`own`, `none`, `all`, or `own,Product`).
 * It narrows the set and never adds one: a listed model still needs its own
 * `useApi` trait. stacksjs/stacks#2866.
 */
export type ModelApiSelection = 'all' | 'own' | 'none' | readonly string[]

export interface ApiSecurityOptions {
  /** @default 'deny' */
  rowScoping: ApiRowScopingPolicy

  /** @default 'all' */
  models: ModelApiSelection
}

export interface SecurityOptions {
  driver: 'aws'

  firewall: FirewallOptions

  /** Security defaults for the routes a model's `useApi` trait generates. */
  api: ApiSecurityOptions
}

export type SecurityConfig = DeepPartial<SecurityOptions>
