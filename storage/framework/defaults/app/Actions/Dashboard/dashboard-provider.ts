import type { DashboardHqDriverOptions, DashboardProviderName, DashboardProviderSelection } from '@stacksjs/types'

/**
 * The seam between a dashboard section and the data behind it.
 *
 * Every section in the dashboard used to reach for a local store directly:
 * the Logs page queried the `logs` table, the Errors pages called into
 * `@stacksjs/commerce`, and web Analytics aggregated the `Request` model. That
 * works exactly once, for the application the dashboard is running inside. It
 * cannot show the logs of a fleet, and it gave the hosted products (loghq,
 * bughq, analyticshq) nowhere to plug in.
 *
 * This module resolves which provider a domain reads from. `local` is the
 * default and is byte-for-byte the behaviour that shipped before the seam
 * existed, including how it fails: a local provider is never wrapped, so a
 * database outage still surfaces the same operational error it always did.
 * Anything else is remote, and remote is wrapped, because a section whose
 * backend is unreachable has to render empty with a reason rather than take
 * the page down.
 *
 * Read paths only. No provider writes.
 */

/** The dashboard sections that resolve a provider. */
export type DashboardProviderDomain = 'logs' | 'errors' | 'analytics'

const PROVIDER_NAMES: readonly DashboardProviderName[] = ['local', 'hq']

/**
 * Why a section has no data.
 *
 * Carried on the payload beside the empty collections rather than thrown, so
 * the section renders its own empty state instead of an error page. The string
 * is written for whoever is looking at the dashboard, not for a log file.
 */
export interface DashboardProviderUnavailable {
  unavailable: string
}

export interface ResolvedDashboardDriver {
  name: DashboardProviderName
  options: DashboardHqDriverOptions
}

const resolved = new Map<DashboardProviderDomain, ResolvedDashboardDriver>()

/**
 * Forgets every memoized driver choice.
 *
 * Resolution is cached per domain so a request does not re-read config on
 * every query. Tests that walk more than one configuration in a single process
 * need that cache cleared between cases, and clearing it is much cheaper than
 * `mock.module`, which replaces the shared module instance for every other
 * test file in the run and is not undone by `mock.restore()`.
 */
export function resetDashboardProviders(): void {
  resolved.clear()
}

function readSelection(section: unknown, domain: DashboardProviderDomain): DashboardProviderSelection {
  if (!section || typeof section !== 'object')
    return {}
  const providers = (section as { providers?: unknown }).providers
  if (!providers || typeof providers !== 'object')
    return {}
  const selection = (providers as Record<string, unknown>)[domain]
  return selection && typeof selection === 'object' ? selection as DashboardProviderSelection : {}
}

function selectDriverName(value: unknown, domain: DashboardProviderDomain): DashboardProviderName {
  if (value === undefined || value === null || value === '')
    return 'local'

  switch (value) {
    case 'local':
      return 'local'
    case 'hq':
      return 'hq'
    default:
      // `satisfies DashboardConfig` is erased at runtime, and config files are
      // ordinary TypeScript an app can hand-edit, so an unknown name reaches
      // here as a plain string. Falling back to local keeps the section
      // rendering; throwing would take it down over a typo.
      console.warn(
        `[dashboard/api] config.dashboard.providers.${domain}.driver is `
        + `"${String(value)}", which is not a known provider. Reading local data instead. `
        + `Available providers: ${PROVIDER_NAMES.join(', ')}.`,
      )
      return 'local'
  }
}

/**
 * Reads a domain's provider choice from config.
 *
 * Config is read through `overridesReady`. A read that happens before the
 * application's own config files have been layered in returns the framework
 * defaults with no error at all, which would silently resolve `local` in an
 * application that had asked for something else.
 */
export async function resolveDashboardDriver(domain: DashboardProviderDomain): Promise<ResolvedDashboardDriver> {
  const cached = resolved.get(domain)
  if (cached)
    return cached

  let selection: DashboardProviderSelection = {}
  try {
    const { config, overridesReady } = await import('@stacksjs/config')
    // Rejection means boot could not read the application's config at all.
    // The framework defaults are still a usable answer, and they are local.
    await overridesReady.catch(() => {})
    selection = readSelection(config.dashboard, domain)
  }
  catch (error) {
    console.warn(`[dashboard/api] dashboard provider config for ${domain} could not be read, using local:`, error)
  }

  const driver: ResolvedDashboardDriver = {
    name: selectDriverName(selection.driver, domain),
    options: selection.drivers?.hq ?? {},
  }

  resolved.set(domain, driver)
  return driver
}

/**
 * Runs a remote provider so that it cannot take a section down.
 *
 * Three ways a remote read goes wrong, all of which land on the same empty
 * payload plus a reason: it rejects, it never answers, or it answers with
 * something that is not the shape the section renders. The last one matters
 * as much as the first two, because a payload that is merely missing its
 * array reaches the component and fails there instead, which is a blank page
 * rather than an empty state.
 */
export async function readThroughProvider<T>(
  domain: DashboardProviderDomain,
  empty: (reason: string) => T,
  read: () => Promise<T>,
  isValid: (payload: unknown) => boolean,
): Promise<T> {
  try {
    const payload = await read()
    if (!isValid(payload)) {
      console.error(`[dashboard/api] the ${domain} provider answered with an unexpected shape`)
      return empty('This section could not be read from its provider.')
    }
    return payload
  }
  catch (error) {
    console.error(`[dashboard/api] the ${domain} provider could not be read:`, error)
    return empty('This section could not be reached. It is configured to read from a hosted provider.')
  }
}

/**
 * The reason an `hq` provider has no data yet.
 *
 * Both published SDKs are ingest clients. `@loghq/stacks` and `@bughq/stacks`
 * send records and expose no function that reads any back, and a project's
 * ingest key grants no read access by design. The hosted read APIs do exist,
 * but they authenticate a person rather than a machine, so wiring one needs a
 * product decision about service credentials before any code here can help.
 *
 * Selecting `hq` today therefore yields an empty section that says so, which
 * is the honest answer and keeps the degrade path real rather than theoretical.
 */
export const HQ_READ_UNAVAILABLE
  = 'No data. The hosted provider has no read API yet, so this section cannot be filled from it.'
