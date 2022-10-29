import { app } from '@stacksjs/config'
import type { CliOptions, IOType } from '@stacksjs/types'

/**
 * Determines the level of debugging.
 * @param options
 */
export function debugLevel(options?: CliOptions): IOType {
  const debug: IOType = app.debug ? 'inherit' : 'ignore'

  if (options?.debug)
    return options.debug ? 'inherit' : 'ignore'

  return debug
}
