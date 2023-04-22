interface ARecord {
  name: string | '@' | '*'
  address: string // IPv4
  ttl?: number | 'auto'
}

interface CNameRecord {
  name: string
  target: string
  ttl: number | 'auto'
}

interface MXRecord {
  name: string | '@'
  mailServer: string
  ttl: number | 'auto'
  priority: number // 0-65535
}

interface TxtRecord {
  name: string | '@'
  ttl: number | 'auto'
  content: string
}

interface AAAARecord {
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
  ns?: []
}
