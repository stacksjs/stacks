export function contains(needle: string, haystack: string[]) {
  return haystack.some(hay => needle.includes(hay))
}

export function containsAll(needles: string[], haystack: string[]) {
  return needles.every(needle => contains(needle, haystack))
}

export function containsAny(needles: string[], haystack: string[]) {
  return needles.some(needle => contains(needle, haystack))
}

export function containsNone(needles: string[], haystack: string[]) {
  return !containsAny(needles, haystack)
}

export function containsOnly(needles: string[], haystack: string[]) {
  return containsAll(haystack, needles)
}
