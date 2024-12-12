// import type { CliOptions } from '@stacksjs/types'
import { CAC } from 'cac'

export interface ParsedArgv {
  args: ReadonlyArray<string>
  options: {
    [k: string]: any
  }
}

interface CliOptions {
  name?: string
  // version: string
  // description: string
}

export function cli(name?: string | CliOptions, options?: CliOptions): CAC {
  if (typeof name === 'object') {
    options = name
    name = options.name
  }

  return new CAC(name || 'buddy')
}

export { CAC }

// export function command(name: string, description: string, options?: CliOptions) {
//   return cli(options).command(name, description)
// }
