import type { LocalTunnel, TunnelOptions } from './tunnel'
import { localTunnel } from './tunnel'

export async function createLocalTunnel(port: number): Promise<string> {
  const tunnel = await localTunnel({ port })
  return tunnel.url
}

/**
 * Deploy a tunnel server to AWS EC2.
 * Only needed for custom domains — localtunnel.dev is the shared default.
 */
export async function deployTunnelServer(config: {
  domain: string
  region?: string
  instanceType?: string
  prefix?: string
  enableSsl?: boolean
  porkbunApiKey?: string
  porkbunSecretKey?: string
  verbose?: boolean
}) {
  const { deployTunnelInfrastructure } = await import('localtunnels/cloud')
  return deployTunnelInfrastructure(config)
}

/**
 * Destroy a previously deployed tunnel server from AWS.
 */
export async function destroyTunnelServer(config: {
  domain?: string
  region?: string
  prefix?: string
  verbose?: boolean
}) {
  const { destroyTunnelInfrastructure } = await import('localtunnels/cloud')
  return destroyTunnelInfrastructure(config)
}

export { localTunnel }
export type { LocalTunnel, TunnelOptions }
