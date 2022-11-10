import type { CliOptions } from '@stacksjs/types'
import { app } from '.'

/**
 * Determines the level of debugging.
 * @param options
 */
export function determineDebugMode(options?: CliOptions) {
  if (options?.debug === true)
    return true

  if (app.debug === true)
    return true

  return false
}
