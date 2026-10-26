import type { Server } from 'bun'
import process from 'node:process'

/** Keep port zero as an explicit request for an OS-owned ephemeral listener. */
export function resolveApiPort(value: string | undefined, configured = 3008): number {
  const port = value?.trim() ? Number(value) : configured
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new RangeError('PORT_API must be an integer between 0 and 65535')
  return port
}

/** Notify supervising tools only after the server owns its actual address. */
export function reportApiReady(server: Pick<Server<unknown>, 'port' | 'url'>): void {
  process.send?.({ type: 'stacks:api-ready', port: server.port, url: server.url.href })
  console.log(`\n  ➜  API server ready: ${server.url.origin}\n`)
}

/** Resolve the interface used by API entrypoints in local and deployed runtimes. */
export function resolveApiHost(env: Record<string, string | undefined> = process.env): string {
  if (env.API_HOST)
    return env.API_HOST

  if (env.HOST)
    return env.HOST

  const isProduction = env.NODE_ENV === 'production' || env.APP_ENV === 'production'
  return isProduction ? '0.0.0.0' : '127.0.0.1'
}
