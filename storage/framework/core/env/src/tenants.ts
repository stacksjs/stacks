/**
 * Tenant namespacing for environment values.
 *
 * A shared box hosts several projects: one owns it, the rest attach to it with
 * `cloud.attachTo`. Each project deploys from its own repository and brings its
 * own `.env.<environment>`, so no project ever needs another's secrets.
 *
 * In practice they leak anyway. A tenant's values get pasted into the owner's
 * env file under a `TENANT_` prefix - usually while debugging a deploy - and
 * then stay. That is worse than untidy: the deploy pipeline ships the owner's
 * whole env file to every site it deploys, so those foreign secrets end up in
 * the `.env` of an unrelated site on disk.
 *
 * Declaring the tenants attached to your box (`cloud.tenants` in
 * `config/cloud.ts`) lets the framework tell the two apart, keep foreign values
 * out of what it ships, and point at them so they can be deleted.
 */

/** Where a key sits relative to the project reading the env file. */
export type EnvKeyOwnership = 'own' | 'foreign'

export interface TenantEnvPartition {
  /** Keys this project owns. Everything not claimed by another tenant. */
  own: Record<string, string>
  /** Keys namespaced to another tenant on the same box, grouped by tenant slug. */
  foreign: Record<string, Record<string, string>>
}

export interface TenantEnvOptions {
  /** This project's own slug, from `project.slug`. Its prefix is never foreign. */
  self?: string
  /** Slugs of the projects attached to this box, from `cloud.tenants`. */
  tenants?: readonly string[]
}

/**
 * Converts a project slug into the env prefix it namespaces keys with:
 * `analytics-hq` and `analytics_hq` both become `ANALYTICSHQ_`.
 */
export function tenantEnvPrefix(slug: string): string {
  return `${slug.replace(/[^a-z0-9]/gi, '').toUpperCase()}_`
}

/**
 * Splits a flat env map into the keys this project owns and the keys namespaced
 * to another tenant on the same box.
 *
 * A key is foreign only when its prefix matches a **declared** tenant slug. The
 * check is never heuristic: `STRIPE_SECRET_KEY` and `AWS_REGION` are vendor
 * prefixes that happen to look the same, and guessing would strip real config.
 * Declare no tenants and nothing is ever classified as foreign.
 *
 * `self` wins over `tenants`, so a project that mistakenly lists itself keeps
 * its own `SELF_`-prefixed values.
 */
export function partitionTenantEnv(
  values: Record<string, string>,
  options: TenantEnvOptions = {},
): TenantEnvPartition {
  const selfPrefix = options.self ? tenantEnvPrefix(options.self) : undefined

  // Longest prefix first, so `analyticshq` wins over a hypothetical `analytics`
  // for a key both could claim.
  const tenants = (options.tenants ?? [])
    .filter(slug => typeof slug === 'string' && slug.trim().length > 0)
    .map(slug => ({ slug, prefix: tenantEnvPrefix(slug) }))
    .filter(({ prefix }) => prefix !== selfPrefix)
    .sort((a, b) => b.prefix.length - a.prefix.length)

  const own: Record<string, string> = {}
  const foreign: Record<string, Record<string, string>> = {}

  for (const [key, value] of Object.entries(values)) {
    const match = tenants.find(({ prefix }) => key.startsWith(prefix))

    if (match) {
      ;(foreign[match.slug] ??= {})[key] = value
      continue
    }

    own[key] = value
  }

  return { own, foreign }
}

/**
 * The env map with every declared tenant's keys removed. Shorthand for the
 * `own` half of {@link partitionTenantEnv}, which is what a deploy ships.
 */
export function stripForeignTenantEnv(
  values: Record<string, string>,
  options: TenantEnvOptions = {},
): Record<string, string> {
  return partitionTenantEnv(values, options).own
}

/**
 * Flattens a partition's foreign half into a sorted `slug` / `keys` report,
 * for a CLI to print.
 */
export function foreignTenantKeys(
  partition: TenantEnvPartition,
): Array<{ tenant: string, keys: string[] }> {
  return Object.entries(partition.foreign)
    .map(([tenant, values]) => ({ tenant, keys: Object.keys(values).sort() }))
    .sort((a, b) => a.tenant.localeCompare(b.tenant))
}
