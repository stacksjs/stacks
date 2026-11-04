import type { ResponseStatus } from '@stacksjs/bun-router'
import { response } from '@stacksjs/router'

/**
 * The feature whose models this error says were never loaded, if it is the
 * ORM's `ModelUnavailableError` for a feature that is off.
 */
function disabledFeature(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== 'ModelUnavailableError')
    return undefined
  const feature = (error as Error & { feature?: unknown }).feature
  return typeof feature === 'string' && feature ? feature : undefined
}

export function dashboardOperationalError(
  error: unknown,
  message: string,
  action: string,
  status: ResponseStatus = 503,
): Response {
  // A page whose feature is off is not an outage, and saying "could not be
  // read" sent people looking at their database (stacksjs/stacks#3184).
  const feature = disabledFeature(error)
  if (feature) {
    console.warn(`[dashboard/api] ${action}: the '${feature}' feature is off`)
    return response.json({
      message: `${feature.charAt(0).toUpperCase()}${feature.slice(1)} is turned off for this app, so this page has no data. Set \`enabled: true\` in config/${feature}.ts to use it.`,
    }, 404)
  }
  console.error(`[dashboard/api] ${action} failed:`, error)
  return response.json({ message }, status)
}

export function dashboardOperationalIssue(error: unknown, message: string, action: string): string {
  console.error(`[dashboard/api] ${action} failed:`, error)
  return message
}
