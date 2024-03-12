import process from 'node:process'
import { log } from '@stacksjs/logging'

interface ParsedArgv {
  args: string[]
  options: {
    [k: string]: string | boolean | number
  }
}

function isLongOption(arg?: string): boolean {
  if (!arg)
    return false

  return arg.startsWith('--')
}

function isShortOption(arg: string): boolean {
  return arg.startsWith('-') && !isLongOption(arg)
}

function parseValue(value: string): string | boolean | number {
  if (value === 'true')
    return true

  if (value === 'false')
    return false

  const numberValue = Number.parseFloat(value)
  if (!Number.isNaN(numberValue))
    return numberValue

  return value.replace(/"/g, '')
}

function parseLongOption(arg: string, argv: string[], index: number, options: { [k: string]: string | boolean | number }): number {
  const [key, value] = arg.slice(2).split('=')
  if (value !== undefined) {
    options[key as string] = parseValue(value)
  }
  else if (index + 1 < argv.length && !argv[index + 1]!.startsWith('-')) {
    options[key as string] = argv[index + 1] as string
    index++
  }
  else {
    options[key as string] = true
  }
  return index
}

function parseShortOption(arg: string, argv: string[], index: number, options: { [k: string]: string | boolean | number }): number {
  const [key, value] = arg.slice(1).split('=')

  // Check if key is undefined and handle it
  if (key === undefined)
    return index

  if (value !== undefined && key !== undefined) {
    for (let j = 0; j < key.length; j++)
      options[key[j] as string] = parseValue(value)
  }
  else {
    for (let j = 0; j < key.length; j++) {
      if (index + 1 < argv.length && j === key.length - 1 && !argv[index + 1]!.startsWith('-')) {
        options[key[j] as string] = parseValue(argv[index + 1]!)
        index++
      }
      else {
        options[key[j] as string] = true
      }
    }
  }

  return index
}

export function parseArgv(argv?: string[]): ParsedArgv {
  if (argv === undefined)
    argv = process.argv.slice(2)

  const args: string[] = []
  const options: { [k: string]: string | boolean | number } = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg)
      continue
    if (isLongOption(arg))
      i = parseLongOption(arg, argv, i, options)
    else if (isShortOption(arg))
      i = parseShortOption(arg, argv, i, options)
    else
      args.push(arg)
  }

  return { args, options }
}

export function parseArgs(argv?: string[]): string[] {
  if (argv === undefined)
    argv = process.argv.slice(2)

  return parseArgv(argv).args
}

interface CliOptions {
  dryRun?: boolean
  quiet?: boolean
  verbose?: boolean
  [k: string]: string | boolean | number | undefined
}

export function parseOptions(options?: CliOptions): CliOptions {
  options = options || {}
  const args = process.argv.slice(2)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg?.startsWith('--')) {
      const key = arg.substring(2) // remove the --
      const camelCaseKey = key.replace(
        /-([a-z])/gi,
        g => (g[1] ? g[1].toUpperCase() : ''), // convert kebab-case to camelCase
      )

      if (i + 1 < args.length) { // if the next arg exists
        if (args[i + 1] === 'true' || args[i + 1] === 'false') { // if the next arg is a boolean
          options[camelCaseKey] = args[i + 1] === 'true' // set the value to the boolean
          i++
        }
        else {
          options[camelCaseKey] = args[i + 1]
          i++
        }
      }
      else {
        options[camelCaseKey] = true
      }
    }
  }

  // if options has no keys, return undefined, e.g. `buddy release`
  if (Object.keys(options).length === 0)
    return { dryRun: false, quiet: false, verbose: false }

  // convert the string 'true' or 'false' to a boolean
  Object.keys(options).forEach((key) => {
    if (!options)
      return { dryRun: false, quiet: false, verbose: false }

    const value = options[key]

    if (value === 'true' || value === 'false')
      options[key] = value === 'true'
  })

  return options
}
// interface BuddyOptions {
//   dryRun?: boolean
//   verbose?: boolean
// }
export function buddyOptions(options?: any): string {
  if (!options) {
    options = process.argv.slice(2)
    options = Array.from(new Set(options))
    // delete the 0 element if it does not start with a -
    // e.g. is used when buddy changelog --dry-run is used
    if (options[0] && !options[0].startsWith('-'))
      options.shift()
  }

  if (options?.verbose) {
    log.debug('process.argv', process.argv)
    log.debug('process.argv.slice(2)', process.argv.slice(2))
    log.debug('options inside buddyOptions', options)
  }

  return options.join(' ')
}
