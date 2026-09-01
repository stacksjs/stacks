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
 * - `'warn'` registers those routes and names the models at boot. This is the
 *   published behaviour and the current default.
 * - `'deny'` does not register mutating routes for a model with no ownership
 *   config. Safer, and breaking: it removes routes an app may be relying on.
 *
 * The default is `'warn'` so nothing changes on upgrade, and an app that wants
 * the safer posture can take it today rather than waiting for a major.
 * stacksjs/stacks#2375.
 */
export type ApiRowScopingPolicy = 'warn' | 'deny'

export interface ApiSecurityOptions {
  /** @default 'warn' */
  rowScoping: ApiRowScopingPolicy
}

export interface SecurityOptions {
  driver: 'aws'

  firewall: FirewallOptions

  /** Security defaults for the routes a model's `useApi` trait generates. */
  api: ApiSecurityOptions
}

export type SecurityConfig = DeepPartial<SecurityOptions>
