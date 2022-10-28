import type { CliOptions } from '@stacksjs/types'
import { type IOType } from '@stacksjs/types'
export * from '../../../../config/app'
export * from '../../../../config/deploy'
export * as docs from '../../../../config/docs'
export * from '../../../../config/git'
export * from '../../../../config/hashing'
export * from '../../../../config/library'
export * from '../../../../config/services'
export * from '../../../../config/ui'

/**
 * Determines the level of debugging.
 * @param options
 * @returns
 */
export function debugLevel(options?: CliOptions) {
  const debug: IOType = app.debug ? 'inherit' : 'ignore'

  if (options?.debug)
    return options.debug ? 'inherit' : 'ignore'

  return debug
}
