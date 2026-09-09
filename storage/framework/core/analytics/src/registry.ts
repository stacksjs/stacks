/**
 * Analytics driver registry.
 *
 * `config.analytics.driver` names one of the drivers; this is the dispatch that
 * turns that name into the script an app renders. It is deliberately loud: a
 * driver that is selected but has no implementation, or is selected but not
 * configured, throws instead of quietly emitting nothing, because analytics
 * that silently does nothing is only discovered by noticing missing data.
 *
 * The switch is exhaustive over `AnalyticsOptions['driver']`, so widening that
 * union without adding a driver here is a compile error rather than a runtime
 * surprise.
 */

import type { AnalyticsConfig, AnalyticsOptions } from '@stacksjs/types'
import type { AnalyticsHeadTag } from './drivers/shared'
import { getFathomAnalyticsHead } from './drivers/fathom'
import { getGoogleAnalyticsHead } from './drivers/google-analytics'
import { getPlausibleAnalyticsHead } from './drivers/plausible'
import { getSelfHostedAnalyticsHead } from './drivers/self-hosted'
import { renderHeadTags } from './drivers/shared'

export type AnalyticsDriverName = AnalyticsOptions['driver']

/** Every driver name that has an implementation behind it. */
export const ANALYTICS_DRIVERS: readonly AnalyticsDriverName[] = [
  'google-analytics',
  'fathom',
  'plausible',
  'self-hosted',
] as const

/**
 * Is this a driver name Stacks implements?
 */
export function isAnalyticsDriver(value: unknown): value is AnalyticsDriverName {
  return typeof value === 'string' && (ANALYTICS_DRIVERS as readonly string[]).includes(value)
}

function misconfigured(driver: AnalyticsDriverName, key: string, field: string): Error {
  return new Error(
    `Analytics driver "${driver}" is selected but not configured: set \`drivers.${key}.${field}\` in config/analytics.ts, or change \`driver\`.`,
  )
}

/**
 * Resolve the configured driver's head tags.
 *
 * Returns an empty array when no driver is configured at all. Throws when a
 * driver is named that Stacks does not implement, or when the named driver is
 * missing the config it needs.
 */
export function getAnalyticsHead(config: AnalyticsConfig): AnalyticsHeadTag[] {
  const driver = config.driver

  if (!driver)
    return []

  if (!isAnalyticsDriver(driver)) {
    throw new Error(
      `Unknown analytics driver "${String(driver)}". Available drivers: ${ANALYTICS_DRIVERS.join(', ')}.`,
    )
  }

  switch (driver) {
    case 'google-analytics': {
      const options = config.drivers?.googleAnalytics
      if (!options?.trackingId)
        throw misconfigured(driver, 'googleAnalytics', 'trackingId')

      return getGoogleAnalyticsHead(options)
    }

    case 'fathom': {
      const options = config.drivers?.fathom
      if (!options?.siteId)
        throw misconfigured(driver, 'fathom', 'siteId')

      return getFathomAnalyticsHead(options)
    }

    case 'plausible': {
      const options = config.drivers?.plausible
      if (!options?.domain)
        throw misconfigured(driver, 'plausible', 'domain')

      return getPlausibleAnalyticsHead(options)
    }

    case 'self-hosted': {
      const options = config.drivers?.selfHosted
      if (!options?.siteId)
        throw misconfigured(driver, 'selfHosted', 'siteId')
      if (!options.apiEndpoint)
        throw misconfigured(driver, 'selfHosted', 'apiEndpoint')

      return getSelfHostedAnalyticsHead(options)
    }

    default: {
      // Exhaustiveness guard: a new value in AnalyticsOptions['driver'] fails to
      // compile here until it has an implementation above.
      const unhandled: never = driver

      throw new Error(`Analytics driver "${String(unhandled)}" has no implementation.`)
    }
  }
}

/**
 * Render the configured driver's tracking script as HTML.
 */
export function generateAnalyticsScript(config: AnalyticsConfig): string {
  const tags = getAnalyticsHead(config)

  if (!tags.length)
    return ''

  return renderHeadTags(tags)
}
