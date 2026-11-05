/**
 * Whether a request to the system tray's own API comes from the tray page.
 *
 * The tray server runs buddy on the developer's projects, deploy included,
 * and has no session to check: it is a local tool. What it must not do is
 * take orders from any other page open in the same browser. A website can
 * POST to `http://localhost:3009` with a `text/plain` body, which needs no
 * CORS preflight, and the route read that body as JSON whatever its type, so
 * `{"action":"deploy","confirmed":true}` from any site started a deploy
 * (stacksjs/stacks#3199).
 *
 * So a request that names an origin must name the tray's own, and a write
 * must declare JSON, which a cross-site page cannot send without a preflight
 * this server would have to approve. A request with no Origin at all comes
 * from outside a browser page (curl, a script), which runs as the developer
 * already.
 */
export function isTrustedTrayRequest(request: Request, trayOrigins: readonly string[]): boolean {
  const origin = request.headers.get('origin')
  if (origin !== null && !trayOrigins.includes(origin))
    return false

  if (request.method === 'GET' || request.method === 'HEAD')
    return true

  const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  return type === 'application/json'
}

/** The origins the tray page is served from: its port on both loopback names, and its domain. */
export function trayOrigins(port: number, trayDomain: string | null): string[] {
  const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
  if (trayDomain)
    origins.push(`https://${trayDomain}`)
  return origins
}
