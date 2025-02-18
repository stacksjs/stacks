import type { LocalTunnel } from './tunnel'
import { localTunnel } from './tunnel'

export async function createLocalTunnel(port: number): Promise<LocalTunnel> {
  return await localTunnel({ port })
}

export { localTunnel }
