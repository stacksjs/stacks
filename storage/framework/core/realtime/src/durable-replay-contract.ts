import { createHash, randomUUID } from 'node:crypto'

const MAX_JSON_NODES = 4096

export interface DurableReplayCursor { incarnation: string, seq: number }
export interface DurableReplayMessage { seq: number, ts: number, event: string, data: unknown }
export interface DurableReplayAppend { channel: string, event: string, data?: unknown, idempotencyKey: string }
export interface DurableReplayRead { channel: string, after: DurableReplayCursor | null, limit?: number }
export interface DurableReplayPage {
  messages: DurableReplayMessage[]
  /** Last returned sequence; never advances past an unreturned message. Null on a gap. */
  cursor: DurableReplayCursor | null
  head: DurableReplayCursor
  prunedThrough: number
  hasMore: boolean
  gap: 'retention' | 'incarnation' | 'cursor_ahead' | null
}
export interface DurableReplayStore {
  append: (input: DurableReplayAppend) => Promise<{ message: DurableReplayMessage, cursor: DurableReplayCursor, duplicate: boolean }>
  replay: (input: DurableReplayRead) => Promise<DurableReplayPage>
  prune: (channel: string) => Promise<{ prunedThrough: number, head: DurableReplayCursor }>
}
export interface DurableReplayOptions {
  maxEvents?: number
  ttlMs?: number
  maxPayloadBytes?: number
  maxReplayBytes?: number
  /** Server-owned clock boundary. Never populate this from an HTTP body. */
  clock?: () => number
}
export interface MemoryDurableReplayOptions extends DurableReplayOptions {
  /** Deterministic fake only. SQL incarnations always use cryptographic UUIDs. */
  incarnation?: () => string
}
export class DurableReplayError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'DurableReplayError' }
}
export interface ReplayPolicy { maxEvents: number, ttlMs: number, maxPayloadBytes: number, maxReplayBytes: number }
export interface ReplayState { incarnation: string, highWaterMark: number, prunedThrough: number, lastRecordedAt: number }
export interface PreparedAppend { channel: string, event: string, operationKey: string, payload: string, fingerprint: string }
export function replayOptions(options: DurableReplayOptions, incarnationFactory: () => string = randomUUID): { policy: ReplayPolicy, policyKey: string, now: () => number, newIncarnation: () => string } {
  const policy: ReplayPolicy = { maxEvents: options.maxEvents ?? 100, ttlMs: options.ttlMs ?? 300000, maxPayloadBytes: options.maxPayloadBytes ?? 65536, maxReplayBytes: options.maxReplayBytes ?? 1048576 }
  if (!Number.isSafeInteger(policy.maxEvents) || policy.maxEvents < 1 || policy.maxEvents > 10000 || !Number.isSafeInteger(policy.ttlMs) || policy.ttlMs < 1 || policy.ttlMs > 31536000000 || !Number.isSafeInteger(policy.maxPayloadBytes) || policy.maxPayloadBytes < 1 || policy.maxPayloadBytes > 65536 || !Number.isSafeInteger(policy.maxReplayBytes) || policy.maxReplayBytes < policy.maxPayloadBytes + 512 || policy.maxReplayBytes > 16777216) throw new TypeError('Invalid bounded replay policy')
  const clock = options.clock?.bind(options) ?? Date.now, incarnation = incarnationFactory.bind(options)
  return { policy, policyKey: JSON.stringify(policy), now() { const value = clock(); if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Replay clock must return a nonnegative safe integer'); return value }, newIncarnation() { const value = incarnation(); if (typeof value !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw new TypeError('Replay incarnation must be a UUID'); return value } }
}
export function channelName(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w.:-]{1,200}$/.test(value)) throw new TypeError('Replay requires a bounded exact channel name')
  return value
}
export function prepareAppend(input: DurableReplayAppend, policy: ReplayPolicy): PreparedAppend {
  channelName(input?.channel)
  if (typeof input.event !== 'string' || !/^[\w.:-]{1,200}$/.test(input.event) || typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200) throw new TypeError('Replay event and operation ID must be bounded strings')
  let nodes = 0, bytes = 0
  const seen = new Set<object>()
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > MAX_JSON_NODES || depth > 32) throw new TypeError('Replay JSON exceeds structural bounds')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'string') { bytes += Buffer.byteLength(value); if (bytes > policy.maxPayloadBytes) throw new TypeError('Replay payload exceeds its byte bound'); return value }
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'object' || !value || seen.has(value) || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) throw new TypeError('Replay payload must be finite, acyclic JSON')
    seen.add(value)
    let result: unknown
    if (Array.isArray(value)) {
      const length = value.length
      // Every JSON array slot becomes a node, including holes that map skips.
      // Check length before traversal/allocation; never stringify a huge sparse array.
      if (!Number.isSafeInteger(length) || length < 0 || length > MAX_JSON_NODES - nodes) throw new TypeError('Replay JSON exceeds structural bounds')
      const array: unknown[] = []
      for (let index = 0; index < length; index++) {
        if (!Object.hasOwn(value, index)) throw new TypeError('Replay JSON arrays must be dense')
        array.push(visit(value[index], depth + 1))
      }
      result = array
    }
    else {
      const object: Record<string, unknown> = Object.create(null)
      for (const key of Object.keys(value).sort()) { bytes += Buffer.byteLength(key); if (bytes > policy.maxPayloadBytes) throw new TypeError('Replay payload exceeds its byte bound'); object[key] = visit((value as Record<string, unknown>)[key], depth + 1) }
      result = object
    }
    seen.delete(value)
    return result
  }
  const payload = JSON.stringify(visit(input.data === undefined ? null : input.data, 0))
  if (Buffer.byteLength(payload) > policy.maxPayloadBytes) throw new TypeError('Replay payload exceeds its byte bound')
  return { channel: input.channel, event: input.event, operationKey: input.idempotencyKey, payload, fingerprint: createHash('sha256').update(JSON.stringify([input.event, payload])).digest('hex') }
}
export function readInput(input: DurableReplayRead): { limit: number, after: DurableReplayCursor | null } {
  channelName(input?.channel)
  const limit = input.limit ?? 100
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Replay limit must be an integer from 1 to 100')
  const cursor = input.after
  if (cursor !== null && (typeof cursor !== 'object' || !cursor || Object.keys(cursor).some(key => !['incarnation', 'seq'].includes(key)) || typeof cursor.incarnation !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(cursor.incarnation) || !Number.isSafeInteger(cursor.seq) || cursor.seq < 0)) throw new TypeError('Replay requires a complete incarnation-bound cursor or null')
  return { limit, after: cursor ? { incarnation: cursor.incarnation, seq: cursor.seq } : null }
}
export function replayGap(state: ReplayState, after: DurableReplayCursor | null): DurableReplayPage['gap'] {
  return after && after.incarnation !== state.incarnation ? 'incarnation' : (after?.seq ?? 0) > state.highWaterMark ? 'cursor_ahead' : (after?.seq ?? 0) < state.prunedThrough ? 'retention' : null
}
export function replayPage(state: ReplayState, after: DurableReplayCursor | null, candidates: DurableReplayMessage[], maxBytes: number): DurableReplayPage {
  const gap = replayGap(state, after), head = { incarnation: state.incarnation, seq: state.highWaterMark }
  if (gap) return { messages: [], cursor: null, head, prunedThrough: state.prunedThrough, gap, hasMore: false }
  const messages: DurableReplayMessage[] = []
  let bytes = 0
  for (const message of candidates) { const size = Buffer.byteLength(JSON.stringify(message)); if (bytes + size > maxBytes) break; messages.push(message); bytes += size }
  const cursor = { incarnation: state.incarnation, seq: messages.at(-1)?.seq ?? after?.seq ?? 0 }
  return { messages, cursor, head, prunedThrough: state.prunedThrough, gap: null, hasMore: cursor.seq < state.highWaterMark }
}
