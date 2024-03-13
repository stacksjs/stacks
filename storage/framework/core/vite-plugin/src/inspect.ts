import Inspect from 'vite-plugin-inspect'
import type { InspectOptions } from '@stacksjs/types'

export function inspect(options?: InspectOptions) {
  return Inspect(options)
}
