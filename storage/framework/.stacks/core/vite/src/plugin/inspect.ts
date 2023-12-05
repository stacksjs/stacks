import Inspect from 'vite-plugin-inspect'
import type { InspectOptions } from 'stacks:types'

export function inspect(options?: InspectOptions) {
  return Inspect(options)
}
