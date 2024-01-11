// import type { CliOptions } from '@stacksjs/types'
import cac from 'cac'
import { version } from '../package.json'

interface ParsedArgv {
  args: ReadonlyArray<string>
  options: {
    [k: string]: any
  }
}

interface CliOptions {
  name?: string
  version: string
  description: string
}

export function cli(name?: string | CliOptions, options?: CliOptions) {
  if (typeof name === 'object') {
    options = name
    name = options.name
  }

  const cli = cac(name)

  cli.help()
  cli.version(options?.version || version)

  return cli
}

export function command(name: string, description: string, options?: CliOptions) {
  return cli(options).command(name, description)
}

export function parseArgs() {
  return cli().parse().args
}

export function parseOptions(): ParsedArgv['options'] {
  const options = cli().parse().options

  // Iterate over the options and convert "true" and "false" strings to boolean
  for (const key in options) {
    if (options[key] === 'true')
      options[key] = true
    else if (options[key] === 'false')
      options[key] = false
  }

  return options
}
