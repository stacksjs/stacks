import type { InspectOptions } from '@stacksjs/types'
import Inspect from 'vite-plugin-inspect'

export function inspect(options?: InspectOptions) {
  return Inspect(options)
}
