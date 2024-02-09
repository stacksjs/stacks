import process from 'node:process'

interface ParsedArgv {
  args: string[]
  options: {
    [k: string]: string | boolean | number
  }
}

function isLongOption(arg: string): boolean {
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
    options[key] = parseValue(value)
  }
  else if (index + 1 < argv.length && !argv[index + 1].startsWith('-')) {
    options[key] = argv[index + 1]
    index++
  }
  else {
    options[key] = true
  }
  return index
}

function parseShortOption(arg: string, argv: string[], index: number, options: { [k: string]: string | boolean | number }): number {
  const [key, value] = arg.slice(1).split('=')

  if (value !== undefined) {
    for (let j = 0; j < key.length; j++)
      options[key[j]] = parseValue(value)
  }
  else {
    for (let j = 0; j < key.length; j++) {
      if (index + 1 < argv.length && j === key.length - 1 && !argv[index + 1].startsWith('-')) {
        options[key[j]] = parseValue(argv[index + 1])
        index++
      }
      else {
        options[key[j]] = true
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
  [k: string]: string | boolean | number | undefined
}

export function parseOptions(options?: CliOptions): object {
  // If options are not provided, use command-line arguments
  if (!options) {
    options = {}
    const args = process.argv.slice(2)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      // Check if the argument is a flag (starts with --)
      if (arg.startsWith('--')) {
        const key = arg.substring(2) // Remove the -- prefix
        // Convert kebab-case to camelCase
        const camelCaseKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase())
        // Check if the next argument is a boolean value or another flag
        if (i + 1 < args.length && (args[i + 1] === 'true' || args[i + 1] === 'false')) {
          options[camelCaseKey] = args[i + 1] === 'true'
          i++ // Skip the next argument since it's a value
        }
        else {
          // If there's no explicit true/false value, assume the flag is true
          options[camelCaseKey] = true
        }
      }
    }
  }
  else {
    // Normalize options: convert string "true"/"false" to boolean values
    Object.keys(options).forEach((key) => {
      const value = options[key]
      if (value === 'true')
        options[key] = true
      else if (value === 'false')
        options[key] = false
    })
  }

  return options
}

export function buddyOptions(options?: any): string {
  if (!options) {
    options = process.argv.slice(2)
    options = Array.from(new Set(options))
    // delete the 0 element if it does not start with a -
    // e.g. is used when buddy changelog --dry-run is used
    if (!options[0].startsWith('-'))
      options.shift()
  }

  if (options?.verbose) {
    log.debug('process.argv', process.argv)
    log.debug('process.argv.slice(2)', process.argv.slice(2))
    log.debug('options inside buddyOptions', options)
  }

  return options.join(' ')
}
