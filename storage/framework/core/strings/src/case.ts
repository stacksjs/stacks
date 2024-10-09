/**
 * First letter uppercase, other lowercase
 * @category string
 * @example
 * ```
 * capitalize('hello world') => 'Hello world'
 * ```
 */
export function capitalize(str: string): string {
  return str[0] ? str[0].toUpperCase() + str.slice(1).toLowerCase() : ''
}

export function lowercase(str: string): string {
  return str.toLowerCase()
}

export {
  camelCase,
  capitalCase,
  constantCase,
  dotCase,
  kebabCase,
  kebabCase as paramCase,
  noCase,
  pascalCase,
  pathCase,
  sentenceCase,
  snakeCase,
  split,
} from 'change-case'
export { titleCase } from 'title-case'
