import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { DashboardFileError } from './file-manager'

/**
 * The response for a file action that threw.
 *
 * A `DashboardFileError` is written to be shown, so it keeps its status,
 * message and fields. Anything else - the database behind `storage_items`
 * being down or not migrated, a driver failing - is logged and answered 503
 * with `message`, because rethrowing it let the router send the raw driver
 * message to the browser in every environment (stacksjs/stacks#3174).
 */
export function dashboardFileFailure(error: unknown, message: string, action: string): Response {
  if (error instanceof DashboardFileError)
    return response.json({ message: error.message, fields: error.fields }, error.status)
  return dashboardOperationalError(error, message, action)
}
