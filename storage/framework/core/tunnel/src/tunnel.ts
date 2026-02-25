import type { TunnelClient } from 'localtunnels'
import { startLocalTunnel } from 'localtunnels'

export interface LocalTunnel {
  url: string
  subdomain: string
  client: TunnelClient
  close: () => void
}

export async function localTunnel(options?: { port: number }): Promise<LocalTunnel> {
  const port = options?.port || 3000

  const client = await startLocalTunnel({ port })

  return {
    url: client.getTunnelUrl(),
    subdomain: client.getSubdomain(),
    client,
    close: () => client.disconnect(),
  }
}
