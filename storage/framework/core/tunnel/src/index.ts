import type { LocalTunnel } from './tunnel'
import { localTunnel } from './tunnel'

export async function createLocalTunnel(port: number): Promise<string> {
  const tunnel = await localTunnel({ port })
  return tunnel.url
}

export { localTunnel }
export type { LocalTunnel }
