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

// export function parseOptions(argv?: string[]): { [k: string]: string | boolean | number } {
//   if (argv === undefined)
//     argv = process.argv.slice(2)

//   return parseArgv(argv).options
// }

export function parseArgs(argv?: string[]): string[] {
  if (argv === undefined)
    argv = process.argv.slice(2)

  return parseArgv(argv).args
}
