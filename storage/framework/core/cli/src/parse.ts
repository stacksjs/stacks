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
  if (!options) {
    options = {}
    const args = process.argv.slice(2)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg?.startsWith('--')) {
        const key = arg.substring(2) // remove the --
        const camelCaseKey = key.replace(/-([a-z])/gi, g => (g[1] ? g[1].toUpperCase() : '')) // convert kebab-case to camelCase
        if (i + 1 < args.length && (args[i + 1] === 'true' || args[i + 1] === 'false')) { // if the next arg is a boolean
          options[camelCaseKey] = args[i + 1] === 'true' // set the value to the boolean
          i++
        }
        else {
          options[camelCaseKey] = true
        }
      }
    }
    return options
  }

  // convert the string 'true' or 'false' to a boolean
  Object.keys(options).forEach((key) => {
    let value
    if (options)
      value = options[key]

    if (value === 'true' || value === 'false') {
      if (options)
        options[key] = value === 'true'
    }
  })

  return options
}

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
