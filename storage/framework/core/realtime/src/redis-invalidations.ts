import type { RedisClient } from 'bun'
import { createHash, randomUUID } from 'node:crypto'
import type { InvalidationBounds, InvalidationBus, InvalidationStatus } from './invalidation-bus'
import { createInvalidationListeners, InvalidationError } from './invalidation-bus'
import { channelName } from './durable-replay-contract'

export interface RedisInvalidationOptions extends InvalidationBounds {
  /** Operator-owned configuration only; never a tenant request value. */
  url: string
  /** Required app/environment namespace. Redis Pub/Sub ignores database numbers. */
  namespace: string
  connectTimeoutMs?: number
  operationTimeoutMs?: number
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
  maxPendingPublishes?: number
  maxRememberedHints?: number
  /** Status enums only. No URL, credentials, Redis errors or domain payloads. */
  onStatus?: (status: InvalidationStatus) => void
}
interface Pair {
  publisher: RedisClient
  subscriber: RedisClient
  topics: Set<string>
  logical: Map<string, string>
  receive: (message: string, topic: string) => void
  initialized: boolean
}
/** @internal Capability detection without importing an unavailable optional driver. */
export function supportsRedisInvalidations(runtime: unknown): boolean {
  const client = (runtime as { RedisClient?: { prototype?: Record<string, unknown> } } | null)?.RedisClient
  return !!client?.prototype && ['connect', 'close', 'publish', 'subscribe', 'unsubscribe'].every(name => typeof client.prototype![name] === 'function')
}
function bound(value: number, maximum: number) { if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new TypeError('Invalid Redis invalidation bounds'); return value }
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i

/** Opt-in metadata-only, at-most-once hints over Bun's experimental native Pub/Sub. */
export function createRedisInvalidationBus(options: RedisInvalidationOptions): InvalidationBus {
  if (!supportsRedisInvalidations(globalThis.Bun)) throw new InvalidationError('invalidation_pubsub_unavailable', 'This Bun runtime does not provide native Redis Pub/Sub')
  let endpoint: URL
  try { endpoint = new URL(options.url) } catch { throw new TypeError('A server-owned Redis URL is required') }
  if (!['redis:', 'rediss:', 'redis+tls:'].includes(endpoint.protocol) || !endpoint.hostname || endpoint.hash || endpoint.search || typeof options.namespace !== 'string' || !/^[\w.:-]{1,100}$/.test(options.namespace)) throw new TypeError('Invalid Redis invalidation endpoint or namespace')
  const Client = globalThis.Bun.RedisClient
  const connectTimeout = bound(options.connectTimeoutMs ?? 2000, 30000), operationTimeout = bound(options.operationTimeoutMs ?? 2000, 30000)
  const delay = bound(options.reconnectDelayMs ?? 50, 10000), maxDelay = bound(options.maxReconnectDelayMs ?? 2000, 30000)
  const maxPublishes = bound(options.maxPendingPublishes ?? 64, 1024), maxSeen = bound(options.maxRememberedHints ?? 1024, 10000)
  if (maxDelay < delay) throw new TypeError('Invalid Redis reconnect delay range')
  const url = endpoint.href, namespace = options.namespace, origin = randomUUID(), statusObserver = options.onStatus?.bind(options)
  let status: InvalidationStatus = 'idle', closed = false, pair: Pair | undefined, connecting: Promise<Pair> | undefined, synchronizing: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined, attempts = 0, activePublishes = 0, previouslyReady = false
  const remembered = new Map<string, true>(), cancelPending = new Set<() => void>()
  const listeners = createInvalidationListeners(options, () => { queueMicrotask(() => { if (closed) return; if (!listeners.channels().length && !pair) { clearTimeout(timer); timer = undefined; return } void synchronize().catch(() => {}) }) })
  const topic = (channel: string) => `${namespace}:invalidation:v1:${createHash('sha256').update(channel).digest('hex')}`
  function state(next: InvalidationStatus) {
    if (status === next) return
    status = next
    try { const result: unknown = statusObserver?.(next); if (result !== undefined) void Promise.resolve(result).catch(() => {}) } catch { /* Status observers cannot break cleanup. */ }
  }
  function closePair(target: Pair) {
    target.publisher.onclose = null; target.subscriber.onclose = null
    target.publisher.close(); target.subscriber.close()
  }
  function schedule() {
    if (closed || timer || !listeners.channels().length) return
    const wait = Math.min(maxDelay, delay * 2 ** attempts)
    attempts = Math.min(attempts + 1, 16)
    timer = setTimeout(() => { timer = undefined; void synchronize().catch(() => { schedule() }) }, wait)
  }
  function lost(target: Pair) {
    if (pair !== target) return
    pair = undefined; closePair(target)
    if (!closed) { state('disconnected'); schedule() }
  }
  async function timed<T>(promise: Promise<T>, target: Pair, milliseconds: number): Promise<T> {
    const deadline = Promise.withResolvers<never>(), cancel = () => deadline.reject(new InvalidationError('invalidation_closed', 'Redis invalidation bus is closed'))
    cancelPending.add(cancel)
    const timeout = setTimeout(() => { lost(target); deadline.reject(new InvalidationError('invalidation_unavailable', 'Redis invalidation operation exceeded its deadline')) }, milliseconds)
    try { return await Promise.race([promise, deadline.promise]) }
    finally { clearTimeout(timeout); cancelPending.delete(cancel) }
  }
  function receive(target: Pair, message: string, physical: string) {
    if (closed || pair !== target || typeof message !== 'string' || message.length > 256 || Buffer.byteLength(message) > 256) return
    const channel = target.logical.get(physical)
    if (!channel) return
    try {
      const hint = JSON.parse(message) as Record<string, unknown>
      if (!hint || typeof hint !== 'object' || Array.isArray(hint) || Object.keys(hint).length !== 3 || !['v', 'origin', 'id'].every(key => Object.hasOwn(hint, key)) || hint.v !== 1 || typeof hint.origin !== 'string' || typeof hint.id !== 'string' || !UUID.test(hint.origin) || !UUID.test(hint.id) || hint.origin === origin) return
      const identity = `${hint.origin}:${hint.id}`
      if (remembered.has(identity)) return
      if (remembered.size >= maxSeen) remembered.delete(remembered.keys().next().value!)
      remembered.set(identity, true); listeners.notify(channel)
    }
    catch { /* Malformed Redis data never becomes a domain event or a log. */ }
  }
  function connection(): Promise<Pair> {
    if (closed) return Promise.reject(new InvalidationError('invalidation_closed', 'Redis invalidation bus is closed'))
    if (pair?.publisher.connected && pair.subscriber.connected) return Promise.resolve(pair)
    if (connecting) return connecting
    if (pair) { const stale = pair; pair = undefined; closePair(stale) }
    state('connecting')
    const settings = { autoReconnect: false, maxRetries: 0, enableOfflineQueue: false, enableAutoPipelining: false, connectionTimeout: connectTimeout, idleTimeout: 0 }
    let target: Pair
    try {
      target = { publisher: new Client(url, settings), subscriber: new Client(url, settings), topics: new Set(), logical: new Map(), receive: (message, physical) => receive(target, message, physical), initialized: false }
    }
    catch { state('disconnected'); schedule(); return Promise.reject(new InvalidationError('invalidation_unavailable', 'Redis invalidation connection is unavailable')) }
    pair = target
    target.publisher.onclose = target.subscriber.onclose = () => lost(target)
    const pending = (async () => {
      try {
        await timed(Promise.all([target.publisher.connect(), target.subscriber.connect()]), target, connectTimeout)
        if (closed || pair !== target) throw new InvalidationError('invalidation_unavailable', 'Redis invalidation connection changed')
        return target
      }
      catch { lost(target); throw new InvalidationError(closed ? 'invalidation_closed' : 'invalidation_unavailable', 'Redis invalidation connection is unavailable') }
    })()
    connecting = pending
    void pending.then(() => { if (connecting === pending) connecting = undefined }, () => { if (connecting === pending) connecting = undefined })
    return pending
  }
  function synchronize(): Promise<void> {
    if (closed) return Promise.reject(new InvalidationError('invalidation_closed', 'Redis invalidation bus is closed'))
    if (synchronizing) return synchronizing
    const pending = (async () => {
      const target = await connection(), end = Date.now() + operationTimeout
      try {
        while (!closed && pair === target) {
          const desired = new Map(listeners.channels().map(channel => [topic(channel), channel]))
          const add = [...desired.keys()].filter(name => !target.topics.has(name)), remove = [...target.topics].filter(name => !desired.has(name))
          for (const [physical, logical] of desired) target.logical.set(physical, logical)
          if (add.length) { await timed(target.subscriber.subscribe(add, target.receive), target, Math.max(1, end - Date.now())); for (const name of add) target.topics.add(name) }
          if (remove.length) { await timed(target.subscriber.unsubscribe(remove), target, Math.max(1, end - Date.now())); for (const name of remove) { target.topics.delete(name); target.logical.delete(name) } }
          if (closed || pair !== target) break
          const latest = listeners.channels()
          if (latest.length === target.topics.size && latest.every(channel => target.topics.has(topic(channel)))) {
            clearTimeout(timer); timer = undefined; attempts = 0; state('ready')
            if (!target.initialized && previouslyReady) listeners.resync()
            target.initialized = true; previouslyReady = true
            return
          }
          if (Date.now() >= end) throw new InvalidationError('invalidation_unavailable', 'Redis subscription synchronization exceeded its deadline')
        }
        throw new InvalidationError('invalidation_unavailable', 'Redis invalidation connection changed')
      }
      catch { lost(target); throw new InvalidationError(closed ? 'invalidation_closed' : 'invalidation_unavailable', 'Redis invalidation subscription is unavailable') }
    })()
    synchronizing = pending
    void pending.then(() => { if (synchronizing === pending) synchronizing = undefined }, () => { if (synchronizing === pending) synchronizing = undefined; schedule() })
    return pending
  }
  return {
    get status() { return status },
    async publish(channel) {
      if (closed) throw new InvalidationError('invalidation_closed', 'Redis invalidation bus is closed')
      channelName(channel); listeners.notify(channel)
      if (activePublishes >= maxPublishes) throw new InvalidationError('invalidation_capacity', 'Redis invalidation publish capacity exceeded')
      activePublishes++
      try {
        await synchronize()
        const target = pair
        if (!target) throw new InvalidationError('invalidation_unavailable', 'Redis invalidation connection is unavailable')
        const count = await timed(target.publisher.publish(topic(channel), JSON.stringify({ v: 1, origin, id: randomUUID() })), target, operationTimeout)
        if (!Number.isSafeInteger(count) || count < 0) throw new InvalidationError('invalidation_unavailable', 'Redis invalidation response is invalid')
        return { subscriberConnections: count }
      }
      catch { throw new InvalidationError(closed ? 'invalidation_closed' : 'invalidation_unavailable', 'Redis invalidation publish is unavailable') }
      finally { activePublishes-- }
    },
    async subscribe(input) {
      const record = listeners.add(input)
      try {
        await Promise.race([synchronize(), record.ended.then(() => { throw new InvalidationError('invalidation_closed', 'Invalidation subscription ended before readiness') })])
        listeners.activate(record)
        return () => listeners.remove(record)
      }
      catch (error) { listeners.remove(record); throw error instanceof InvalidationError ? error : new InvalidationError('invalidation_unavailable', 'Redis invalidation subscription is unavailable') }
    },
    async close() {
      if (closed) return
      closed = true; clearTimeout(timer); timer = undefined
      for (const cancel of cancelPending) cancel()
      const target = pair; pair = undefined
      if (target) closePair(target)
      listeners.close(); remembered.clear(); state('closed')
    },
  }
}
