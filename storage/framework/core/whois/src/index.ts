import Net from 'node:net'
import fetch from 'node-fetch'
import type { SocksClientOptions } from 'socks'
import { SocksClient } from 'socks'
import PARAMETERS from './parameters'
import SERVERS from './servers'

const IANA_CHK_URL = 'https://www.iana.org/whois?q='

/**
 * Find the WhoIs server for the TLD from IANA WhoIs service. The TLD is be searched and the HTML response is parsed to extract the WhoIs server
 *
 * @param tld TLD of the domain
 * @returns WhoIs server which hosts the information for the domains of the TLD
 */
async function findWhoIsServer(tld: string): Promise<string> {
  const chkURL = IANA_CHK_URL + tld

  try {
    const res = await fetch(chkURL)
    if (res.ok) {
      const body = await res.text()
      const server = body.match(/whois:\s+(.*)\s+/)
      if (server?.[1]) return server[1]
    }
  } catch (err) {
    console.error('Error in getting WhoIs server data from IANA', err)
  }

  return ''
}
/**
 * Copy an Object with its values
 *
 * @param obj Object which needs to be copied
 * @returns A copy of the object
 */
function shallowCopy<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.slice() as T // Clone the array
  }

  if (typeof obj === 'object' && obj !== null) {
    const copy: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) copy[key] = shallowCopy(obj[key])
    }
    return copy as T
  }

  return obj // For primitive values, return as is
}

/**
 * Get whois server of the tld from servers list
 *
 * @param tld TLD of the domain
 * @returns WhoIs server which hosts the information for the domains of the TLD
 */
function getWhoIsServer(tld: keyof typeof SERVERS): string | undefined {
  return SERVERS[tld]
}

/**
 * Extract TLD from domain name.
 * If the TLD is in whois-servers.json file, then the TLD is returned.
 * If TLD is not found within the file, then determined by taking the last element after splitting the domain name from '.'
 *
 * @param domain Domain name
 * @returns TLD
 */
function getTLD(domain: string): keyof typeof SERVERS {
  let tld: keyof typeof SERVERS | null = null
  let domainStr = domain

  while (true) {
    const domainData = domainStr.split('.')
    if (domainData.length < 2) break

    const tldCheck = domainData.slice(1).join('.') as keyof typeof SERVERS
    const server = SERVERS[tldCheck]
    if (server) {
      tld = tldCheck
      break
    }
    domainStr = tldCheck
  }

  if (tld) return tld

  console.debug('TLD is not found in server list. Returning last element after split as TLD!')

  const domainData = domain.split('.')
  return domainData[domainData.length - 1] as keyof typeof SERVERS
}

// get whois query parameters if exist on parameters.json for whois server
function getParameters(server: string): string | undefined {
  return (PARAMETERS as { [key: string]: string })[server]
}

/**
 * Type of the proxy. Either SOCKS4 or SOCKS5
 * @enum
 */
export enum ProxyType {
  /**
   * SOCKS4 type of proxy
   */
  SOCKS4 = 0,
  /**
   * SOCKS5 type of proxy
   */
  SOCKS5 = 1,
}

/**
 * Proxy related data
 * @interface
 *
 */
export interface ProxyData {
  /**
   * Proxy IP
   */
  ip: string
  /**
   * Proxy port
   */
  port: number
  /**
   * Username to connect to the proxy
   */
  username?: string | null
  /**
   * Password to connect to the proxy
   */
  password?: string | null
  /**
   * {@link ProxyType}
   */
  type: ProxyType
}

/**
 * WhoIs options
 * @interface
 */
export interface WhoIsOptions {
  /**
   * TLD of the domain. If the {@link tld} is not provided (or null), then it will be automatically determined as to the given domain name
   */
  tld?: string | null
  /**
   * The encoding type used for WhoIs server and response. By default UTF-8 is used.
   */
  encoding?: string | null

  /** {@link ProxyData} */
  proxy?: ProxyData | null
  /**
   * The WhoIs server to collect data from. If not provided, the server will automatically determined using the {@link tld}
   */
  server?: string | null
  /**
   * The port of the WhoIs server. By default, port 43 is used.
   */
  serverPort?: number | null
  /**
   * Which data needs to be extracted/parsed from the WhoIs response.
   * An object can be passed which contains keys of the fields of the WhoIs response.
   * A copy of the provided object will be returned with the values filled for the provided keys.
   *
   * The keys can have default value of empty string. However, if the WhoIs response has multiple values for the same field (eg: 'Domain Status'),
   * then all the values can be collected by providing a default value of an Array([]).
   *
   * Following example shows an object used to collect 'Domain Name', 'Domain Status' (multiple values) and 'Registrar' from WhoIs response
   *
   * @example {'Domain Name': '', 'Domain Status': [], 'Registrar': ''}
   */
  parseData?: object | null
}

/**
 * Response returned from whois function. Contains the raw text from WhoIs server and parsed/fornatted WhoIs data (if parsed is true)
 *
 * @interface
 */
export interface WhoIsResponse {
  /**
   * Raw text response from WhoIs server
   */
  _raw: string
  /**
   * Parsed/Formatted key-value pairs of the response (if parsed is true)
   */
  parsedData: any | null
}

/**
 * Parse collected raw WhoIs data
 *
 * @class
 */
export class WhoIsParser {
  /**
   * Iterated through the complete text and returns extracted values
   *
   * @param rawData raw text from WhoIs server
   * @param outputData Data which needs to be extracted from the raw text (key/value pairs). Keys are used to extract from raw text and values are filled.
   * @returns Filled {@link outputData}
   */
  private static iterParse(rawData: string, outputData: any) {
    let lastStr = ''
    let lastField: string | null = null
    let lastLetter = ''

    for (let i = 0; i < rawData.length; i++) {
      const letter = rawData[i]
      if (letter === '\n' || (lastLetter === ':' && letter === ' ')) {
        if (lastStr.trim() in outputData) {
          lastField = lastStr.trim()
        } else if (lastField !== null) {
          const x = lastStr.trim()
          if (x !== '') {
            const obj = outputData[lastField]
            if (Array.isArray(obj)) obj.push(x)
            else outputData[lastField] = x

            lastField = null
          }
        }
        lastStr = ''
      } else if (letter !== ':') {
        lastStr = lastStr + letter
      }
      lastLetter = letter as string
      if (lastStr === 'Record maintained by' || lastStr === '>>>') break
    }

    return outputData
  }

  /**
   * Parse the raw WhoIs text and returns extracted values
   *
   * @param rawData raw text from WhoIs server
   * @param outputData Data which needs to be extracted from the raw text (key/value pairs). Keys are used to extract from raw text and values are filled.
   * @returns Filled {@link outputData}
   */
  public static parseData(rawData: string, outputData: any | null): any {
    if (!outputData) {
      outputData = {
        'Domain Name': '',
        'Creation Date': '',
        'Updated Date': '',
        'Registry Expiry Date': '',
        'Domain Status': [],
        Registrar: '',
      }
    }

    outputData = WhoIsParser.iterParse(rawData, outputData)

    return outputData
  }
}

/**
 * Connects to the provided {@link server}:{@link port} through TCP (through a proxy if a proxy is given), run the WhoIs query and returns the response
 *
 * @param domain Domain name
 * @param queryOptions Query options which can be used with the specific WhoIs server to get the complete response
 * @param server WhoIs server
 * @param port WhoIs server port
 * @param encoding Encoding used by the WhoIs server
 * @param proxy {@link ProxyData}
 * @returns The {string} WhoIs response for the query. Empty string is returned for errors
 */
export async function tcpWhois(
  domain: string,
  queryOptions: string,
  server: string,
  port: number,
  encoding: string,
  proxy: ProxyData | null,
): Promise<string> {
  const decoder = new TextDecoder(encoding)
  const encoder = new TextEncoder()

  if (!proxy) {
    const socket = new Net.Socket()
    return new Promise((resolve, reject) => {
      try {
        socket.connect({ port, host: server }, () => {
          if (queryOptions !== '') socket.write(encoder.encode(`${queryOptions} ${domain}\r\n`))
          else socket.write(encoder.encode(`${domain}\r\n`))
        })

        socket.on('data', (data) => {
          resolve(decoder.decode(data))
        })

        socket.on('error', (error) => {
          reject(error)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  const options: SocksClientOptions = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: proxy.type === ProxyType.SOCKS5 ? 5 : 4,
    },

    command: 'connect',

    destination: {
      host: server,
      port,
    },
  }

  if (proxy.username && proxy.password) {
    options.proxy.userId = proxy.username
    options.proxy.password = proxy.password
  }

  return new Promise((resolve, reject) => {
    SocksClient.createConnection(options, (err, info) => {
      if (err) {
        reject(err)
      } else {
        if (!info) reject(new Error('No socket info received!'))

        if (queryOptions !== '') {
          info?.socket.write(encoder.encode(`${queryOptions} ${domain}\r\n`))
        } else {
          info?.socket.write(encoder.encode(`${domain}\r\n`))
        }

        info?.socket.on('data', (data) => {
          resolve(decoder.decode(data))
        })

        info?.socket.resume()
      }
    })
  })
}

/**
 * Collect WhoIs data for the mentioned {@link domain}. Parse the reveived response if {@link parse} is true, accordingly.
 *
 * @param domain Domain name
 * @param parse Whether the raw text needs to be parsed/formatted or not
 * @param options {@link WhoIsOptions}
 * @returns {@link WhoIsResponse} Returns a {@link WhoIsResponse} object which contains the raw text and parsed data (if parse is true)
 */
export async function whois(
  domain: string,
  parse = false,
  options: WhoIsOptions | null = null,
): Promise<WhoIsResponse> {
  let tld: string
  let port = 43
  let server = ''
  let proxy: ProxyData | null
  let encoding = 'utf-8'

  if (!options) {
    tld = getTLD(domain)
    proxy = null
  } else {
    tld = options.tld ? options.tld : getTLD(domain)
    encoding = options.encoding ? options.encoding : 'utf-8'
    proxy = options.proxy ? options.proxy : null
    server = options.server ? options.server : ''
    port = options.serverPort ? options.serverPort : 43
  }

  if (server === '') {
    let serverData = getWhoIsServer(tld as keyof typeof SERVERS)
    if (!serverData) {
      console.debug(`No WhoIs server found for TLD: ${tld}! Attempting IANA WhoIs database for server!`)
      serverData = await findWhoIsServer(tld)
      if (!serverData) {
        console.debug('WhoIs server could not be found!')
        return {
          _raw: '',
          parsedData: null,
        }
      }
      console.debug(`WhoIs sever found for ${tld}: ${server}`)
    }

    server = serverData
  }

  const qOptions = getParameters(server)
  const queryOptions = qOptions || ''

  try {
    const rawData = await tcpWhois(domain, queryOptions, server, port, encoding, proxy)
    if (!parse) {
      const parsedData = WhoIsParser.parseData(rawData, null)
      return {
        _raw: rawData,
        parsedData,
      }
    }

    let outputData: any | null = null
    if (options?.parseData) outputData = shallowCopy(options.parseData)

    try {
      const parsedData = WhoIsParser.parseData(rawData, outputData)
      return {
        _raw: rawData,
        parsedData,
      }
    } catch (err) {
      console.error('Error in parsing WhoIs data!', err)
      return {
        _raw: rawData,
        parsedData: null,
      }
    }
  } catch (err) {
    return {
      _raw: '',
      parsedData: null,
    }
  }
}

export function lookup(domain: string, options: WhoIsOptions | null = null): Promise<WhoIsResponse> {
  return whois(domain, true, options)
}

/**
 * Collects (and parse/format if set to be true) for the provided {@link domains}. If {@link parallel} is set to be true, multiple threads will be used to batch process the domains according to {@link threads} mentioned.
 * If <i>options.parsedData</i> is mentioned, then it will be used to parse <b>all</b> the responses.
 * If a proxy is mentioned in {@link options}, then the proxy will be used to collect <b>all</b> the WhoIs data.
 *
 * @param domains Domains Names
 * @param parallel Whether data should be collected parallally or not
 * @param threads Batch size (for parallel processing)
 * @param parse Whether the raw text needs to be parsed/formatted or not
 * @param options {@link WhoIsOptions}
 * @returns Array of {@link WhoIsResponse} for all the domains. Order is not guaranteed
 */
export async function batchWhois(
  domains: string[],
  parallel = false,
  threads = 1,
  parse = false,
  options: WhoIsOptions | null = null,
): Promise<WhoIsResponse[]> {
  let response: WhoIsResponse[] = []

  if (parallel) {
    if (threads > domains.length) threads = domains.length

    for (let i = 0; i < domains.length; i += threads) {
      const batch = domains.slice(i, i + threads)
      response = await Promise.all(
        batch.map(async (domain) => {
          return await whois(domain, parse, options)
        }),
      )
    }
  } else {
    for (let i = 0; i < domains.length; i++) {
      const res = await whois(domains[i] as string, parse, options)
      response.push(res)
    }
  }

  return response
}
