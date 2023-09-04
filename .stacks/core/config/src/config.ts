import { StacksOptions } from '@stacksjs/types'
import defaults from './defaults'
import overrides from './overrides'
import { defu } from 'defu'

export const config: StacksOptions = defu(overrides, defaults)

export { defaults, overrides }

export * from './defaults'
export * from './overrides'
export * from './helpers'
