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
