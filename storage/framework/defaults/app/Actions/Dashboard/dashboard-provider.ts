import type { HqClient, HqUnavailable } from '@stacksjs/hq/client'
import type { DashboardHqDriverOptions, DashboardProviderName, DashboardProviderSelection, HqServiceName, HqServiceOptions } from '@stacksjs/types'
import { createHqClient } from '@stacksjs/hq/client'

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
 * The reason the Analytics section has no data from `hq` yet.
 *
 * Logs and Errors read from LogHQ and BugHQ with a project read key (see
 * `dashboardHqClient` below). AnalyticsHQ has no read-key endpoint, so
 * selecting `hq` for analytics still yields an empty section that says so.
 */
export const HQ_READ_UNAVAILABLE
  = 'No data. The hosted provider has no read API yet, so this section cannot be filled from it.'

/** The hosted service behind each domain that can be read today. */
const HQ_DOMAIN_SERVICE = { logs: 'loghq', errors: 'bughq' } as const satisfies Partial<Record<DashboardProviderDomain, HqServiceName>>

const HQ_LABELS: Record<HqServiceName, string> = {
  bughq: 'BugHQ',
  loghq: 'LogHQ',
  analyticshq: 'AnalyticsHQ',
  statushq: 'StatusHQ',
  commshq: 'CommsHQ',
  reportshq: 'ReportsHQ',
}

export type DashboardHqDomain = keyof typeof HQ_DOMAIN_SERVICE

/**
 * A hosted read that came back with nothing, and the sentence to show for it.
 *
 * Thrown by an `hq` provider so its methods keep the same signatures as the
 * local one's; the section's reader turns it into an empty payload carrying
 * `reason`.
 */
export class DashboardProviderUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(reason)
    this.name = 'DashboardProviderUnavailableError'
  }
}

/** Why a hosted read has no data, for whoever is looking at the dashboard. */
export function hqUnavailableReason(result: HqUnavailable): string {
  const label = HQ_LABELS[result.service]
  const connect = `Run \`buddy hq:connect ${result.service}\``
  switch (result.reason) {
    case 'not_configured':
      return `${label} is not connected. ${connect} to connect it.`
    case 'unauthorized':
      return `${label} refused the read key. ${connect} to get a new one.`
    case 'timeout':
    case 'network':
      return `${label} could not be reached. This section will fill in once it answers again.`
    case 'http':
      // The services answer 404, not 401, for a key that does not open the project.
      return result.status === 404
        ? `${label} has no project that this read key opens. ${connect} to connect it again.`
        : `${label} could not be read (it answered ${result.status}).`
    default:
      return `${label} answered something this section cannot show.`
  }
}

/**
 * The client a domain's `hq` provider reads with.
 *
 * Credentials come from `config/services.ts`, where `buddy hq:connect` put them.
 * The domain's own `drivers.hq` settings win where set, so one section can
 * point at another project or a self-hosted instance.
 */
export async function dashboardHqClient(domain: DashboardHqDomain, options: DashboardHqDriverOptions = {}): Promise<HqClient> {
  const service = HQ_DOMAIN_SERVICE[domain]
  let configured: HqServiceOptions | undefined
  try {
    const { config, overridesReady } = await import('@stacksjs/config')
    await overridesReady.catch(() => {})
    configured = config.services?.[service]
  }
  catch (error) {
    console.warn(`[dashboard/api] config.services could not be read for ${domain}:`, error)
  }

  return createHqClient({
    services: {
      [service]: {
        url: options.baseUrl || configured?.url || '',
        readKey: options.token || configured?.readKey || '',
        project: options.project || configured?.project,
      },
    },
    timeoutMs: options.timeoutMs ?? 5000,
  })
}
