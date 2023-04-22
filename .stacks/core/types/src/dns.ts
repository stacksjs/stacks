export interface ARecord {
  name: string | '@' | '*'
  address: string // IPv4
  ttl?: number | 'auto'
}

export interface CNameRecord {
  name: string
  target: string
  ttl: number | 'auto'
}

export interface MXRecord {
  name: string | '@'
  mailServer: string
  ttl: number | 'auto'
  priority: number // 0-65535
}

export interface TxtRecord {
  name: string | '@'
  ttl: number | 'auto'
  content: string
}

export interface AAAARecord {
  name: string | '@' | '*'
  address: string // IPv6
  ttl: number | 'auto'
}

export type DnsRecord = ARecord | CNameRecord | MXRecord | TxtRecord | AAAARecord

export interface DnsOptions {
  /**
   * **DNS Options**
   *
   * This configuration defines all of your DNS options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   *
   * @default {}
   * @see https://stacksjs.dev/docs/dns
   */
  a?: ARecord[]
  aaaa?: AAAARecord[]
  cname?: CNameRecord[]
  mx?: MXRecord[]
  txt?: TxtRecord[]
}
