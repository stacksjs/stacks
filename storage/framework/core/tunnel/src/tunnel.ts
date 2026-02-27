import type { TunnelClient } from 'localtunnels'
import { startLocalTunnel } from 'localtunnels'

export interface TunnelOptions {
  /** Local port to expose through the tunnel */
  port: number
  /** Tunnel server URL (default: localtunnel.dev) */
  server?: string
  /** Request a specific subdomain */
  subdomain?: string
  /** Enable verbose logging */
  verbose?: boolean
  /** Connection timeout in milliseconds */
  timeout?: number
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number
  /** Called when tunnel connects */
  onConnect?: (info: { url: string, subdomain: string }) => void
  /** Called on each proxied request */
  onRequest?: (req: { method: string, url: string }) => void
  /** Called on each proxied response */
  onResponse?: (res: { status: number, size: number, duration: number }) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Called when reconnecting */
  onReconnecting?: (info: { attempt: number, delay: number }) => void
}

export interface LocalTunnel {
  url: string
  subdomain: string
  client: TunnelClient
  close: () => Promise<void>
}

export async function localTunnel(options?: TunnelOptions | { port: number }): Promise<LocalTunnel> {
  const opts = options || { port: 3000 }
  const port = opts.port || 3000

  const tunnelOpts: Parameters<typeof startLocalTunnel>[0] = {
    port,
    ...('server' in opts && opts.server ? { server: opts.server } : {}),
    ...('subdomain' in opts && opts.subdomain ? { subdomain: opts.subdomain } : {}),
    ...('verbose' in opts && opts.verbose !== undefined ? { verbose: opts.verbose } : {}),
    ...('timeout' in opts && opts.timeout ? { timeout: opts.timeout } : {}),
    ...('maxReconnectAttempts' in opts && opts.maxReconnectAttempts ? { maxReconnectAttempts: opts.maxReconnectAttempts } : {}),
    ...('onConnect' in opts && opts.onConnect ? { onConnect: opts.onConnect } : {}),
    ...('onRequest' in opts && opts.onRequest ? { onRequest: opts.onRequest } : {}),
    ...('onResponse' in opts && opts.onResponse ? { onResponse: opts.onResponse as any } : {}),
    ...('onError' in opts && opts.onError ? { onError: opts.onError } : {}),
    ...('onReconnecting' in opts && opts.onReconnecting ? { onReconnecting: opts.onReconnecting } : {}),
  }

  const client = await startLocalTunnel(tunnelOpts)

  return {
    url: client.getTunnelUrl(),
    subdomain: client.getSubdomain(),
    client,
    close: () => client.disconnect() as Promise<void>,
  }
}
