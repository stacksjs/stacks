export function contains(needle: string, haystack: string[]) {
  return haystack.some(hay => needle.includes(hay))
}
