---
name: stacks-whois
description: Use when performing WHOIS lookups in Stacks — domain queries, batch lookups, SOCKS proxy support, TLD server discovery, response parsing, the WhoIsParser class, or the built-in SocksClient. Covers @stacksjs/whois.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks WHOIS

Domain WHOIS lookup with SOCKS proxy support, batch processing, TLD server discovery, and response parsing. Includes a native SOCKS4/SOCKS5 client implementation.

## Key Paths
- Core package: `storage/framework/core/whois/src/`

## Source Files
```
whois/src/
├── index.ts          # whois(), lookup(), batchWhois(), tcpWhois(), WhoIsParser, exports
├── types.ts          # WhoIsResponse, WhoIsOptions, ProxyData, ProxyType
├── constants.ts      # IANA_CHK_URL, PARAMETERS, SERVERS
├── utils.ts          # shallowCopy helper
└── socks.ts          # Native SocksClient implementation (SOCKS4/SOCKS5)
```

## Main Functions

### whois() -- Primary Lookup
```typescript
async function whois(
  domain: string,
  parse?: boolean,          // default: false (but still parses with default fields)
  options?: WhoIsOptions | null,
): Promise<WhoIsResponse>
```

When `parse` is `false` (default), it still calls `WhoIsParser.parseData(rawData, null)` which parses with the default field set. When `parse` is `true` and `options.parseData` is provided, it uses a shallow copy of that object as the parse template.

Flow:
1. Determine TLD from domain (or use `options.tld`)
2. Find WHOIS server: check `SERVERS` map first, then query IANA via `findWhoIsServer()`
3. Get query parameters via `getParameters()` for the server
4. Execute TCP query via `tcpWhois()`
5. Parse response via `WhoIsParser.parseData()`
6. Returns `{ _raw: string, parsedData: any | null }`

### lookup() -- Parsed Lookup Shortcut
```typescript
function lookup(domain: string, options?: WhoIsOptions | null): Promise<WhoIsResponse>
```
Calls `whois(domain, true, options)` -- always parses the response.

### batchWhois() -- Batch Lookups
```typescript
async function batchWhois(
  domains: string[],
  parallel?: boolean,       // default: false
  threads?: number,         // default: 1 (batch size for parallel mode)
  parse?: boolean,          // default: false
  options?: WhoIsOptions | null,
): Promise<WhoIsResponse[]>
```

- Sequential mode (`parallel=false`): processes domains one at a time
- Parallel mode (`parallel=true`): processes in batches of `threads` size using `Promise.all`
- If `threads > domains.length`, clamps to `domains.length`
- Note: In parallel mode, only the last batch's results are returned (`response` is reassigned, not concatenated)

### tcpWhois() -- Raw TCP Query
```typescript
async function tcpWhois(
  domain: string,
  queryOptions: string,     // server-specific prefix (e.g., '-T dn,ace')
  server: string,
  port: number,             // default 43
  encoding: string,         // default 'utf-8'
  proxy: ProxyData | null,
): Promise<string>
```

- Without proxy: creates `Net.Socket`, connects directly to WHOIS server on specified port
- With proxy: uses `SocksClient.createConnection()` to tunnel through SOCKS proxy
- Sends query as `"<queryOptions> <domain>\r\n"` or `"<domain>\r\n"` if no queryOptions
- Uses `TextDecoder` with specified encoding for response

## Server Discovery

### findWhoIsServer() -- Remote IANA Lookup
```typescript
async function findWhoIsServer(tld: string): Promise<string>
```
Fetches `https://www.iana.org/whois?q=<tld>` and extracts server from `whois:\s+(\S+)` regex match. Returns empty string on failure.

### getWhoIsServer() -- Local Lookup
```typescript
function getWhoIsServer(tld: keyof typeof SERVERS): string | undefined
```
Looks up TLD in the built-in `SERVERS` map. Special case: `'com'` always returns `'whois.verisign-grs.com'`.

### getTLD() -- Extract TLD
```typescript
function getTLD(domain: string): keyof typeof SERVERS
```
Splits domain by `.` and checks from longest suffix first against the `SERVERS` map. For example, `sub.example.co.uk` checks `co.uk` first (which exists in SERVERS), not just `uk`. Falls back to the last part if no match found.

### getParameters() -- Server Query Parameters
```typescript
function getParameters(server: string): string | undefined
```
Returns server-specific query format from the `PARAMETERS` map.

## WhoIsParser

```typescript
class WhoIsParser {
  // Parse raw WHOIS text with custom or default field template
  static parseData(rawData: string, outputData: any | null): any

  // Internal iterative parser (private)
  private static iterParse(rawData: string, outputData: any): any
}
```

When `outputData` is `null`, `parseData()` uses this default template:
```typescript
{
  'Domain Name': '',
  'Creation Date': '',
  'Updated Date': '',
  'Registry Expiry Date': '',
  'Domain Status': [],       // array collects multiple values
  'Registrar': '',
}
```

The parser iterates character by character through raw WHOIS text:
- Keys are identified when a line matches a key in `outputData`
- Values follow after `": "` separator
- Array-typed fields (like `Domain Status`) accumulate multiple values
- Parsing stops at `"Record maintained by"` or `">>>"` markers

Custom parse templates: pass an object with the field names you want extracted. Use empty string `''` for single values, use `[]` for fields with multiple values.

```typescript
const result = await whois('example.com', true, {
  parseData: {
    'Domain Name': '',
    'Domain Status': [],     // collects ALL status values
    'Registrar': '',
    'Name Server': [],       // collects ALL name servers
  }
})
```

## Types

### WhoIsResponse
```typescript
interface WhoIsResponse {
  _raw: string              // raw text from WHOIS server
  parsedData: any | null    // parsed key-value pairs (null on error)
}
```

### WhoIsOptions
```typescript
interface WhoIsOptions {
  tld?: string | null              // override TLD detection
  encoding?: string | null         // character encoding (default: 'utf-8')
  proxy?: ProxyData | null         // SOCKS proxy configuration
  server?: string | null           // override WHOIS server
  serverPort?: number | null       // override port (default: 43)
  parseData?: object | null        // custom parse template (keys to extract)
}
```

### ProxyData
```typescript
interface ProxyData {
  ip: string
  port: number
  username?: string | null
  password?: string | null
  type: ProxyType
}
```

### ProxyType
```typescript
enum ProxyType {
  SOCKS4 = 0,
  SOCKS5 = 1,
}
```

Note: `ProxyType.SOCKS4 = 0` and `ProxyType.SOCKS5 = 1` -- these are mapped to SOCKS versions `4` and `5` internally when creating SocksClient options.

## SOCKS Proxy Support

```typescript
const result = await whois('example.com', false, {
  proxy: {
    ip: '127.0.0.1',
    port: 1080,
    type: ProxyType.SOCKS5,
    username: 'user',        // optional
    password: 'pass',        // optional
  }
})
```

## Built-in SocksClient (socks.ts)

Native SOCKS client implementation using `node:net`. Replaces the `socks` npm package.

```typescript
class SocksClient {
  static createConnection(
    options: SocksClientOptions,
    callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void,
  ): void
}

interface SocksClientOptions {
  proxy: SocksProxy
  command: 'connect' | 'bind' | 'associate'
  destination: SocksDestination
}

interface SocksProxy {
  host: string
  port: number
  type: 4 | 5               // SOCKS version
  userId?: string
  password?: string
}

interface SocksDestination {
  host: string
  port: number
}

interface SocksClientEstablishedEvent {
  socket: Net.Socket
  remoteHost?: string
  remotePort?: number
}
```

### SOCKS4 Implementation
- Supports SOCKS4 and SOCKS4a (domain name support via special IP marker `0.0.0.1`)
- Request format: VN(1) + CD(1) + DSTPORT(2) + DSTIP(4) + USERID(var) + NULL(1)
- Success response: status byte `0x5A` (90)

### SOCKS5 Implementation
- Three-step handshake: greeting -> authentication (optional) -> connect request
- Supports no-auth (`0x00`) and username/password auth (`0x02`)
- Supports IPv4 (`0x01`), IPv6 (`0x04`), and domain name (`0x03`) address types
- Detailed error messages for all SOCKS5 status codes (general failure, not allowed, network unreachable, host unreachable, connection refused, TTL expired, command not supported, address type not supported)

## Constants

### IANA_CHK_URL
```typescript
const IANA_CHK_URL = 'https://www.iana.org/whois?q='
```

### PARAMETERS -- Server-Specific Query Formats
```typescript
const PARAMETERS: Record<string, string> = {
  'whois.denic.de': '-T dn,ace',
  'whois.nic.fr': '-V Md5.2',
}
```

### SERVERS -- TLD to WHOIS Server Mapping
Comprehensive mapping of hundreds of TLDs to their WHOIS servers. Examples:
- `'com'` -> `'whois.verisign-grs.com'`
- `'net'` -> `'whois.verisign-grs.com'`
- `'org'` -> `'whois.pir.org'`
- `'io'` -> `'whois.nic.io'`
- `'co.uk'` -> compound TLD support via `getTLD()` longest-match logic
- Country code TLDs, new gTLDs, compound TLDs (e.g., `br.com`, `co.ca`)

## Utility: shallowCopy (utils.ts)

```typescript
function shallowCopy<T>(obj: T): T
```
Recursively copies objects and arrays. Used to clone `parseData` templates before filling them with parsed values, so the original template is not mutated.

## Exports from index.ts

Functions: `whois`, `lookup`, `batchWhois`, `tcpWhois`, `findWhoIsServer`, `getWhoIsServer`, `getTLD`, `getParameters`
Classes: `WhoIsParser`, `SocksClient`
Constants: `IANA_CHK_URL`, `PARAMETERS`, `SERVERS`
Types: `WhoIsResponse`, `WhoIsOptions`, `ProxyData`, `ProxyType`, `SocksClientOptions`

## Dependencies
- `node:net` -- TCP socket connections (direct WHOIS queries and SOCKS client)
- `@stacksjs/logging` -- `log` for debug logging during lookups

## Gotchas
- `whois()` with `parse=false` still parses with default fields -- the `parse` flag controls whether custom `parseData` is used
- `batchWhois()` in parallel mode has a bug: it reassigns `response` each batch instead of concatenating, so only the last batch's results are returned
- `ProxyType` enum values are `0` and `1`, not `4` and `5` -- they are mapped to SOCKS versions internally
- `getWhoIsServer()` returns `undefined` for unknown TLDs, not an empty string
- `findWhoIsServer()` returns empty string `''` on failure (not `undefined`)
- `getTLD()` checks compound TLDs (like `co.uk`) before simple ones via longest-suffix matching
- The parser stops at `"Record maintained by"` or `">>>"` markers in the raw response
- WHOIS servers are rate-limited -- batch queries should use small thread counts
- `shallowCopy()` is a recursive deep copy despite its name -- it clones nested objects and arrays
- TCP connections use `node:net` Socket, not `fetch` -- WHOIS is a raw TCP protocol on port 43
- The SOCKS client uses callback-style API, not promises
- Query options are prepended to the domain in the TCP query (e.g., `"-T dn,ace example.de\r\n"`)
