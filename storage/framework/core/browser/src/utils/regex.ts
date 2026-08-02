// export function caseInsensitive(pattern: string): RegExp {
//   return new RegExp(pattern, 'i')
// }

export function createRegExp(pattern: string, options: { flags?: string } = {}): RegExp {
  return new RegExp(pattern, options.flags)
}
