/**
 * One environment gate, shared by every integration that talks to a remote
 * service (stacksjs/stacks#2792).
 *
 * The problem it solves is not labelling. An adapter that attaches
 * unconditionally and tags its events `development` still transmits them, so a
 * laptop and a CI run report into the same project as production and a local
 * startup failure reads as a live incident. The label describes the event; it
 * does not stop it leaving.
 *
 * So the gate is evaluated *before* an adapter initializes. A gate that answers
 * `false` means no upload client, no remote capture hook, no injected tracking
 * script, no flush timer and no request - not "send it marked local". Ordinary
 * console and file logging are unaffected: they are not this gate's business.
 *
 * The configuration surface is deliberately one option:
 *
 * ```ts
 * bughq: {
 *   key: env.BUGHQ_KEY,
 *   environments: ['production', 'staging'],
 * }
 * ```
 *
 * There is no sibling `environment` field and no `enabledIn`. An application
 * never repeats `env.APP_ENV` in each integration: the effective value is
 * resolved here once, used to check the allowlist, and handed back on
 * {@link IntegrationGate.environment} so the adapter can attach it as event
 * metadata without asking.
 *
 * **`APP_ENV` is a configuration label, not proof of deployment identity.** A
 * command launched locally with `APP_ENV=production` passes a production
 * allowlist, because nothing here can tell the difference. Treat the allowlist
 * as "which labels may transmit", not as an authorization boundary.
 */

/**
 * The default allowlist for a remote-telemetry integration.
 *
 * Deployed environments report; a developer's machine, CI and test runs do not,
 * until someone adds their label. New integrations should adopt this rather than
 * inventing a policy, and an existing installation's behaviour should not be
 * changed silently by picking it up.
 */
export const REMOTE_TELEMETRY_ENVIRONMENTS: readonly string[] = ['production', 'staging']

/** The environment-gating surface an integration's own options extend. */
export interface EnvironmentGatedIntegration {
  /**
   * A master switch. `false` always disables the integration; `true` does *not*
   * bypass the allowlist, so it cannot be used to turn on production reporting
   * from a laptop by accident.
   */
  enabled?: boolean
  /**
   * The environment labels permitted to transmit. Omitted means the caller's
   * default (see {@link REMOTE_TELEMETRY_ENVIRONMENTS}); an empty array disables
   * every environment, which is the explicit way to switch an integration off
   * without removing its credentials.
   */
  environments?: readonly string[]
}

/** Why the gate answered as it did. Worth logging; worth asserting in tests. */
export type IntegrationGateReason =
  | 'disabled-explicitly'
  | 'empty-allowlist'
  | 'environment-unknown'
  | 'environment-excluded'
  | 'environment-allowed'

export interface IntegrationGate {
  /** Whether the adapter may initialize and transmit. */
  enabled: boolean
  /**
   * The effective environment label, for the adapter to attach to included
   * events. `undefined` when nothing declared one, which is also why the gate
   * closed in that case.
   */
  environment: string | undefined
  reason: IntegrationGateReason
}

/**
 * Fold the spellings that mean the same deployment onto one name, so an
 * allowlist of `['prod']` admits `APP_ENV=production` and the reverse.
 *
 * Only these three aliases, and only exact matches. `local`, `development` and
 * `test` are deliberately **not** folded together: they are three different
 * places with three different reasons to be excluded, and a framework that
 * quietly treated them as one would make "allow my machine" also mean "allow
 * CI". `@stacksjs/env`'s own loader normalizes the same three aliases when it
 * picks an `.env` file to read.
 */
export function normalizeEnvironmentName(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(normalized))
    return undefined

  if (normalized === 'prod')
    return 'production'
  if (normalized === 'stage')
    return 'staging'
  if (normalized === 'dev')
    return 'development'

  return normalized
}

/**
 * The environment an integration should gate on, or `undefined` when nothing
 * declared one.
 *
 * Read at call time rather than at import: `APP_ENV` is routinely set after the
 * module graph loads - a test harness pinning it, a CLI resolving `--env` - and
 * a const would freeze whatever happened to be set first (stacksjs/stacks#2581).
 *
 * Unlike `appEnv()`, which answers `local` so callers always have a string, this
 * answers `undefined`. The difference matters here: an unset or unreadable
 * `APP_ENV` must not be *guessed* into a label that an allowlist might admit.
 */
export function integrationEnvironment(): string | undefined {
  return normalizeEnvironmentName(process.env.APP_ENV) ?? normalizeEnvironmentName(process.env.NODE_ENV)
}

/**
 * Decide whether an integration may initialize in this process.
 *
 * Same answer in a web or API server, the dashboard, a worker and a CLI
 * command, because all of them read the same `APP_ENV`.
 *
 * @param options the integration's own configuration
 * @param defaultEnvironments the allowlist to use when the app did not set one
 */
export function integrationGate(
  options: EnvironmentGatedIntegration | undefined | null,
  defaultEnvironments: readonly string[] = REMOTE_TELEMETRY_ENVIRONMENTS,
): IntegrationGate {
  const environment = integrationEnvironment()

  // Checked before anything else, so `enabled: false` is always the last word.
  if (options?.enabled === false)
    return { enabled: false, environment, reason: 'disabled-explicitly' }

  const allowlist = options?.environments ?? defaultEnvironments

  if (allowlist.length === 0)
    return { enabled: false, environment, reason: 'empty-allowlist' }

  // Fail closed. An unknown environment cannot be matched against an allowlist
  // without inventing a label for it, and the label it would be most damaging
  // to invent is the one that transmits.
  if (environment === undefined)
    return { enabled: false, environment, reason: 'environment-unknown' }

  const permitted = new Set<string>()
  for (const entry of allowlist) {
    const name = normalizeEnvironmentName(entry)
    if (name !== undefined)
      permitted.add(name)
  }

  return permitted.has(environment)
    ? { enabled: true, environment, reason: 'environment-allowed' }
    : { enabled: false, environment, reason: 'environment-excluded' }
}
