/**
 * `@stacksjs/waf`: zig-waf in process, for an app that is not behind rpx
 * (local development, serverless). On a box deploy rpx's dataplane runs the
 * same engine in front of the app; this is for the places it is not.
 *
 * One `Waf` compiles the rules once and inspects each request in its own
 * transaction: connection, request line and headers (phase 1), then the body
 * (phase 2). In `detection` mode a match is reported and nothing is refused;
 * in `blocking` mode the engine's enforced decision refuses the request.
 */

import type { ZigWafLibrary } from './ffi'
import type { WafRuleSettings } from './rules'
import { bytes, CONFIG_SIZE, INTERVENTION_SIZE, Mode, openLibrary, Phase, ptr, Status, statusName } from './ffi'
import { findWafLibrary } from './library'
import { renderWafRules } from './rules'

export { findWafLibrary, libraryFileName } from './library'
export { renderWafRules } from './rules'
export type { RenderedRules, WafRuleSettings } from './rules'

export type WafMode = 'off' | 'detection' | 'blocking'

export interface WafOptions extends WafRuleSettings {
  /** @default 'detection' */
  mode?: Exclude<WafMode, 'off'>
  /** Path to zig-waf's shared library; falls back to ZIG_WAF_LIBRARY. */
  library?: string
  maxHeaderCount?: number
  maxHeaderBytes?: number
  maxRequestTargetBytes?: number
}

export interface WafRequest {
  method: string
  /** Path and query, as sent: `/search?q=1`. */
  uri: string
  protocol?: string
  headers: Iterable<[string, string]>
  body?: string | Uint8Array
  /** The connection, as the engine's REMOTE_ADDR / SERVER_PORT rules see it. zig-waf refuses port 0. */
  clientAddress: string
  clientPort: number
  serverAddress: string
  serverPort: number
}

export interface WafDecision {
  /** A rule asked for a disruptive action. */
  matched: boolean
  /** The engine enforced it: always false in detection mode. */
  enforced: boolean
  /** The HTTP status the rule asked for, when it named one. */
  status?: number
  /** The rule that made the decision, e.g. 949110 for CRS's inbound anomaly score. */
  ruleId?: number
}

export class Waf {
  readonly mode: Exclude<WafMode, 'off'>
  readonly warnings: string[]
  readonly maxBodyBytes: number
  private handle: bigint
  private readonly lib: ZigWafLibrary

  constructor(options: WafOptions) {
    this.mode = options.mode ?? 'detection'
    this.maxBodyBytes = options.maxBodyBytes ?? 131_072
    this.lib = openLibrary(findWafLibrary(options.library))

    const rules = renderWafRules(options)
    this.warnings = rules.warnings

    const config = new DataView(new ArrayBuffer(CONFIG_SIZE))
    config.setUint32(0, CONFIG_SIZE, true)
    config.setUint32(4, 0x00010001, true)
    config.setUint32(8, this.mode === 'blocking' ? Mode.ENABLED : Mode.DETECTION_ONLY, true)
    const limits = [options.maxRequestTargetBytes ?? 8192, options.maxHeaderCount ?? 128, options.maxHeaderBytes ?? 65_536, this.maxBodyBytes, this.maxBodyBytes]
    limits.forEach((limit, index) => config.setBigUint64(16 + index * 8, BigInt(limit), true))

    const text = bytes(rules.text)
    const dataDir = bytes(rules.dataDir)
    const out = new BigUint64Array(1)
    const status = this.lib.zig_waf_create_with_rules_at(ptr(config.buffer), ptr(text), text.length, ptr(dataDir), dataDir.length, ptr(out))
    if (status !== Status.OK)
      throw new Error(`zig-waf refused the rules (${statusName(status)}). Run \`zig-waf validate\` on them for the line at fault.`)
    this.handle = out[0]!
  }

  inspect(request: WafRequest): WafDecision {
    if (!this.handle)
      throw new Error('This Waf has been closed.')

    const out = new BigUint64Array(1)
    this.check(this.lib.zig_waf_transaction_create(this.handle, ptr(out)), 'start a transaction')
    const tx = out[0]!
    try {
      const client = bytes(request.clientAddress)
      const server = bytes(request.serverAddress)
      this.check(this.lib.zig_waf_transaction_process_connection(tx, ptr(client), client.length, request.clientPort, ptr(server), server.length, request.serverPort), 'read the connection')

      const uri = bytes(request.uri)
      const method = bytes(request.method.toUpperCase())
      const protocol = bytes(request.protocol ?? 'HTTP/1.1')
      this.check(this.lib.zig_waf_transaction_process_uri(tx, ptr(uri), uri.length, ptr(method), method.length, ptr(protocol), protocol.length), 'read the request line')

      for (const [name, value] of request.headers) {
        const n = bytes(name)
        const v = bytes(value)
        this.check(this.lib.zig_waf_transaction_add_request_header(tx, ptr(n), n.length, v.length ? ptr(v) : null, v.length), 'read a header')
      }
      this.check(this.lib.zig_waf_transaction_process_request_headers(tx), 'process the headers')
      this.check(this.lib.zig_waf_transaction_evaluate_phase(tx, Phase.REQUEST_HEADERS), 'evaluate the headers')

      const decided = this.decision(tx)
      if (decided.matched)
        return decided

      const body = request.body === undefined ? undefined : bytes(request.body)
      if (body && body.length > 0)
        this.check(this.lib.zig_waf_transaction_write_request_body(tx, ptr(body), Math.min(body.length, this.maxBodyBytes)), 'read the body')
      this.check(this.lib.zig_waf_transaction_process_request_body(tx), 'process the body')
      this.check(this.lib.zig_waf_transaction_evaluate_phase(tx, Phase.REQUEST_BODY), 'evaluate the body')
      return this.decision(tx)
    }
    finally {
      this.lib.zig_waf_transaction_destroy(tx)
    }
  }

  close(): void {
    if (!this.handle)
      return
    this.check(this.lib.zig_waf_destroy(this.handle), 'close')
    this.handle = 0n
  }

  private decision(tx: bigint): WafDecision {
    const out = new DataView(new ArrayBuffer(INTERVENTION_SIZE))
    out.setUint32(0, INTERVENTION_SIZE, true)
    out.setUint32(4, 0x00010001, true)
    const status = this.lib.zig_waf_transaction_intervention(tx, ptr(out.buffer))
    if (status === Status.NOT_FOUND)
      return { matched: false, enforced: false }
    this.check(status, 'read the decision')

    const code = out.getUint16(12, true)
    return {
      matched: true,
      enforced: out.getUint8(14) === 1,
      status: code || undefined,
      ruleId: out.getUint8(15) === 1 ? out.getUint32(16, true) : undefined,
    }
  }

  private check(status: number, step: string): void {
    if (status !== Status.OK)
      throw new Error(`zig-waf could not ${step} (${statusName(status)}).`)
  }
}
