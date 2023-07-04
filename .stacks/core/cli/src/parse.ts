import { parser } from './parser'

export const args = process.argv.slice(2)
export const parsedArgs = parseArgs(args)

export function parseArgs(args?: ReadonlyArray<string>) {
  if (!args)
    args = process.argv.slice(2)

  return parser(args)
}
