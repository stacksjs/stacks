/** Configured public asset headers, applied by both development and production hosts. */
export function applyResponseHeaders(request: Request, response: Response, rules?: Record<string, Record<string, string>>): Response | undefined {
  if (!rules || response.status === 101) return
  const pathname = new URL(request.url).pathname
  const values = Object.entries(rules).filter(([pattern]) => pattern.endsWith('/*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern).flatMap(([, headers]) => Object.entries(headers))
  if (!values.length) return
  try {
    for (const [key, value] of values) response.headers.set(key, value)
  }
  catch {
    const headers = new Headers(response.headers)
    for (const [key, value] of values) headers.set(key, value)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}
