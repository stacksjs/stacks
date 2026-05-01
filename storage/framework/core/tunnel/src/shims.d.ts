declare module 'localtunnels/cloud' {
  export function deployTunnelInfrastructure(config: Record<string, unknown>): Promise<unknown>
  export function destroyTunnelInfrastructure(config: Record<string, unknown>): Promise<unknown>
}

declare module 'localtunnels' {
  export type TunnelClient = any
  export function startLocalTunnel(options?: any): Promise<any>
}
