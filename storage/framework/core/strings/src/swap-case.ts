// thanks to https://github.com/blakeembrey/change-case/blob/main/packages/swap-case/src/index.ts

export function swapCase(input: string, locale?: string[] | string): string {
  let result = ''
  for (const char of input) {
    const lower = char.toLocaleLowerCase(locale)
    result += char === lower ? char.toLocaleUpperCase(locale) : lower
  }
  return result
}
