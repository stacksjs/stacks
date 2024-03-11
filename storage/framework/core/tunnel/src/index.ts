import { localTunnel } from './tunnel'

export async function createLocalTunnel(port: number) {
  return await localTunnel({ port })
}

export { localTunnel }
