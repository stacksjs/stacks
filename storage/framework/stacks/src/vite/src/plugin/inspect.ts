import Inspect from 'vite-plugin-inspect'
import type { InspectOptions } from 'src/types/src'

export function inspect(options?: InspectOptions) {
  return Inspect(options)
}
