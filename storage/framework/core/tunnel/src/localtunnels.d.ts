// Type declarations for localtunnels package
// The published package has broken exports paths (dtsx issue)
// These declarations bridge the gap until the package is fixed

declare module 'localtunnels' {
  import { EventEmitter } from 'node:events'

  export function startLocalTunnel(options: {
    port: number
    subdomain?: string
    host?: string
    server?: string
    verbose?: boolean
    timeout?: number
    maxReconnectAttempts?: number
    manageHosts?: boolean
    onConnect?: (info: { url: string, subdomain: string }) => void
    onRequest?: (req: { method: string, url: string }) => void
    onResponse?: (res: { status: number, size: number, duration?: number }) => void
    onError?: (error: Error) => void
    onReconnecting?: (info: { attempt: number, delay: number }) => void
  }): Promise<TunnelClient>

  export class TunnelClient extends EventEmitter {
    getState(): string
    connect(): Promise<void>
    disconnect(): Promise<void>
    isConnected(): boolean
    getSubdomain(): string
    getTunnelUrl(): string
  }

  export class TunnelServer extends EventEmitter {
    start(): Promise<void>
    stop(): void
  }
}

declare module 'localtunnels/cloud' {
  export interface TunnelDeployConfig {
    region?: string
    prefix?: string
    domain?: string
    hostedZoneId?: string
    instanceType?: string
    keyName?: string
    verbose?: boolean
    enableSsl?: boolean
    porkbunApiKey?: string
    porkbunSecretKey?: string
  }

  export interface TunnelDeployResult {
    publicIp: string
    instanceId: string
    securityGroupId: string
    allocationId: string
    serverUrl: string
    wsUrl: string
    domain?: string
    region: string
  }

  export function deployTunnelInfrastructure(config?: TunnelDeployConfig): Promise<TunnelDeployResult>
  export function destroyTunnelInfrastructure(config?: TunnelDeployConfig): Promise<void>
}
