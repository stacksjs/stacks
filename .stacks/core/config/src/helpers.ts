import { app } from '@stacksjs/config'
import type { CliOptions, StdioOption } from '@stacksjs/types'

/**
 * Determines the level of debugging.
 * @param options
 */
export function debugLevel(options?: CliOptions): StdioOption {
  if (options?.loadingAnimation && options?.debug === true)
    return 'inherit'

  if (options?.loadingAnimation)
    return 'ignore'

  if (options?.debug)
    return options.debug ? 'inherit' : 'ignore'

  return app.debug ? 'inherit' : 'ignore'
}
