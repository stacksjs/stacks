/**
 * Reverse-proxy helpers shared by the dev views server
 * (core/actions/src/dev/views.ts) and the production server
 * (`buddy serve`) so same-origin `/api/**` traffic behaves identically
 * in both topologies (stacksjs/stacks#1950).
 */

const API_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Whether a request can only be answered by bun-router — it targets the
 * canonical `/api/**` prefix, or uses a verb that never matches a
 * static stx page render. Without the verb rule,
 * `route.post('/subscribe', ...)` declared at the root hits stx-serve
 * and 404s.
 */
export function isApiBoundRequest(req: Request, pathname: string): boolean {
  return pathname.startsWith('/api/') || API_METHODS.has(req.method)
}

export async function proxyToBackend(req: Request, backendBase: string, stripPrefix?: string): Promise<Response> {
  const incoming = new URL(req.url)
  let pathname = incoming.pathname
  if (stripPrefix && (pathname === stripPrefix || pathname.startsWith(`${stripPrefix}/`))) {
    pathname = pathname.slice(stripPrefix.length) || '/'
  }
  const target = `${backendBase}${pathname}${incoming.search}`

  const fwd = new Headers(req.headers)
  fwd.delete('host')
  fwd.delete('content-length')
  fwd.set('x-forwarded-host', incoming.host)
  fwd.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const body = req.method === 'GET' || req.method === 'HEAD'
    ? undefined
    : await req.arrayBuffer()

  const upstream = await fetch(target, {
    method: req.method,
    headers: fwd,
    body,
    redirect: 'manual',
  })

  // Re-emit the body without the upstream's content-length /
  // content-encoding — the body we forward may be re-chunked, and
  // letting the original headers through breaks the response.
  const out = new Headers(upstream.headers)
  out.delete('content-length')
  out.delete('content-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}
