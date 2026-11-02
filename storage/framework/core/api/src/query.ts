/** Add query values without moving them into a URL fragment. Relative paths stay relative. */
export function withQuery(url: string, values: Record<string, unknown>, replace = false): string {
  const hashIndex = url.indexOf('#')
  const fragment = hashIndex < 0 ? '' : url.slice(hashIndex)
  const head = hashIndex < 0 ? url : url.slice(0, hashIndex)
  const queryIndex = head.indexOf('?')
  const path = queryIndex < 0 ? head : head.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex < 0 ? '' : head.slice(queryIndex + 1))
  for (const [name, value] of Object.entries(values)) {
    if (value != null) {
      if (replace) params.set(name, String(value))
      else params.append(name, String(value))
    }
  }
  const query = params.toString()
  return path + (query ? `?${query}` : '') + fragment
}
