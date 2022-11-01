export function contains(needle: string, haystack: string[]) {
  return haystack.some(hay => needle.includes(hay))
}

export function containsAll(needles: string[], haystack: string[]) {
  return needles.every(needle => contains(needle, haystack))
}
