declare module '@stacksjs/dnsx' {
  export interface DnsClientOptions {
    domains?: string[]
    type?: string
    nameserver?: string
    class?: string
    udp?: boolean
    tcp?: boolean
    tls?: boolean
    https?: boolean
    short?: boolean
    json?: boolean
    verbose?: boolean
    server?: string
    timeout?: number
  }

  export interface DnsQueryRecord {
    name: string
    type: string
    ttl: number
    data: string
    [key: string]: unknown
  }

  export interface DnsResponse {
    records: DnsQueryRecord[]
    server: string
    queryTime: number
    [key: string]: unknown
  }

  export interface FormatOptions {
    json?: boolean
    short?: boolean
    showDuration?: number
    colors?: { enabled: boolean }
    rawSeconds?: boolean
  }

  export class DnsClient {
    constructor(options?: DnsClientOptions)
    query(domain?: string, type?: string): Promise<DnsResponse>
  }

  export function formatOutput(response: DnsResponse, options?: FormatOptions): string

  export function lookup(domain: string, type?: string): Promise<DnsQueryRecord[]>
}
