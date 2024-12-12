import type { InspectOptions } from '@stacksjs/types'
import type { Plugin } from 'vite'
import Inspect from 'vite-plugin-inspect'

export function inspect(options?: InspectOptions): Plugin {
  return Inspect(options)
}
