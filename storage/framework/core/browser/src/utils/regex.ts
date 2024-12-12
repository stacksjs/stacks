export type {
  Flag,
  Input,
  MagicRegExp,
  MagicRegExpMatchArray,
  MapToStringCapturedBy,
  StringCapturedBy,
} from 'magic-regexp'
export {
  anyOf,
  carriageReturn,
  caseInsensitive,
  char,
  charIn,
  charNotIn,
  digit,
  dotAll,
  exactly,
  global,
  letter,
  linefeed,
  maybe,
  multiline,
  not,
  oneOrMore,
  sticky,
  tab,
  unicode,
  whitespace,
  withIndices,
  word,
  wordBoundary,
  wordChar,
} from 'magic-regexp'

// export function caseInsensitive(pattern: string): RegExp {
//   return new RegExp(pattern, 'i')
// }

export function createRegExp(pattern: string, options: { flags?: string } = {}): RegExp {
  return new RegExp(pattern, options.flags)
}
