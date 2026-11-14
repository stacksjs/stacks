import { AsyncResource } from 'node:async_hooks'
import { channelName } from './durable-replay-contract'

export interface InvalidationNotice { readonly channels: readonly string[], readonly reason: 'hint' | 'resync' }
export interface InvalidationSubscription {
  /** Exact server-selected channels, captured before any await. */
  channels: readonly string[]
  onInvalidate: (notice: InvalidationNotice) => void | Promise<void>
  /** Terminal bus/handler failure, not ordinary caller unsubscribe. */
  onClose?: () => void
  signal?: AbortSignal
}
export type InvalidationStatus = 'idle' | 'connecting' | 'ready' | 'disconnected' | 'closed'
export interface InvalidationBus {
  readonly status: InvalidationStatus
  publish: (channel: string) => Promise<{ subscriberConnections: number }>
  /** Resolves after subscription readiness. Its synchronous disposer is idempotent. */
  subscribe: (options: InvalidationSubscription) => Promise<() => void>
  close: () => Promise<void>
}
export interface InvalidationBounds {
  maxChannels?: number
  maxSubscriptions?: number
  maxPending?: number
  callbackTimeoutMs?: number
}
export class InvalidationError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'InvalidationError' }
}
export interface MemoryInvalidationBus extends InvalidationBus { resync: () => void }
interface Registration {
  channels: readonly string[]
  callback: (notice: InvalidationNotice) => void | Promise<void>
  closeObserver?: () => void
  active: boolean
  removed: boolean
  running: boolean
  resync: boolean
  pending: Set<string>
  abort: AbortController
  ended: Promise<void>
  end: () => void
  detach: () => void
}
/** @internal Shared bounded delivery contract; drivers never carry domain payloads. */
export interface InvalidationListeners {
  add: (options: InvalidationSubscription) => Registration
  activate: (record: Registration) => void
  remove: (record: Registration, terminal?: boolean) => void
  notify: (channel: string) => void
  resync: () => void
  channels: () => string[]
  close: () => void
}
/** @internal */
export function createInvalidationListeners(options: InvalidationBounds = {}, changed: () => void = () => {}): InvalidationListeners {
  const maxChannels = options.maxChannels ?? 1024, maxSubscriptions = options.maxSubscriptions ?? 1024, maxPending = options.maxPending ?? 64, timeoutMs = options.callbackTimeoutMs ?? 5000
  if (!Number.isSafeInteger(maxChannels) || maxChannels < 1 || maxChannels > 4096 || !Number.isSafeInteger(maxSubscriptions) || maxSubscriptions < 1 || maxSubscriptions > 4096 || !Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new TypeError('Invalid invalidation delivery bounds')
  const records = new Set<Registration>(), channels = new Map<string, Set<Registration>>()
  let closed = false
  function remove(record: Registration, terminal = false) {
    if (record.removed) return
    record.removed = true; record.pending.clear(); record.resync = false; record.abort.abort(); record.detach(); record.end(); records.delete(record)
    for (const channel of record.channels) { const members = channels.get(channel); members?.delete(record); if (!members?.size) channels.delete(channel) }
    changed()
    if (terminal && record.active) { try { const result: unknown = record.closeObserver?.(); if (result !== undefined) void Promise.resolve(result).catch(() => {}) } catch { /* Observers cannot interrupt cleanup. */ } }
  }
  async function pump(record: Registration) {
    if (record.running || !record.active || record.removed) return
    record.running = true
    try {
      while (!record.removed && (record.resync || record.pending.size)) {
        const resync = record.resync, channel = record.pending.values().next().value as string | undefined
        record.resync = false
        if (resync) record.pending.clear()
        else record.pending.delete(channel!)
        const notice: InvalidationNotice = Object.freeze({ channels: resync ? record.channels : Object.freeze([channel!]), reason: resync ? 'resync' : 'hint' })
        let timer: ReturnType<typeof setTimeout> | undefined
        const deadline = Promise.withResolvers<never>(), aborted = () => deadline.reject(new InvalidationError('invalidation_closed', 'Invalidation subscription ended'))
        record.abort.signal.addEventListener('abort', aborted, { once: true })
        timer = setTimeout(() => deadline.reject(new InvalidationError('invalidation_callback_timeout', 'Invalidation callback exceeded its deadline')), timeoutMs)
        try { await Promise.race([Promise.resolve().then(() => record.removed ? undefined : record.callback(notice)), deadline.promise]) }
        catch { remove(record, true); return }
        finally { clearTimeout(timer); record.abort.signal.removeEventListener('abort', aborted) }
      }
    }
    finally { record.running = false }
  }
  function enqueue(record: Registration, channel?: string) {
    if (record.removed) return
    if (channel === undefined || !record.pending.has(channel) && record.pending.size >= maxPending) { record.pending.clear(); record.resync = true }
    else if (!record.resync) record.pending.add(channel)
    void pump(record)
  }
  return {
    add(input) {
      if (closed) throw new InvalidationError('invalidation_closed', 'Invalidation bus is closed')
      if (!Array.isArray(input.channels) || !input.channels.length || input.channels.length > maxChannels || typeof input.onInvalidate !== 'function' || records.size >= maxSubscriptions) throw new InvalidationError('invalidation_capacity', 'Invalid invalidation subscription or capacity exceeded')
      const selected = new Set<string>()
      for (let index = 0; index < input.channels.length; index++) { if (!Object.hasOwn(input.channels, index)) throw new TypeError('Invalidation channels must be dense'); selected.add(channelName(input.channels[index])) }
      if (channels.size + [...selected].filter(channel => !channels.has(channel)).length > maxChannels) throw new InvalidationError('invalidation_capacity', 'Invalidation channel capacity exceeded')
      const signal = input.signal
      if (signal?.aborted) throw new InvalidationError('invalidation_closed', 'Invalidation subscription is aborted')
      const ended = Promise.withResolvers<void>()
      const record: Registration = { channels: Object.freeze([...selected]), callback: AsyncResource.bind(input.onInvalidate, undefined, input), closeObserver: input.onClose ? AsyncResource.bind(input.onClose, undefined, input) : undefined, active: false, removed: false, running: false, resync: false, pending: new Set(), abort: new AbortController(), ended: ended.promise, end: () => ended.resolve(), detach: () => {} }
      const abort = () => remove(record, true)
      record.detach = () => signal?.removeEventListener('abort', abort)
      signal?.addEventListener('abort', abort, { once: true })
      records.add(record)
      for (const channel of record.channels) { let members = channels.get(channel); if (!members) { members = new Set(); channels.set(channel, members) } members.add(record) }
      changed()
      return record
    },
    activate(record) { if (record.removed) throw new InvalidationError('invalidation_closed', 'Invalidation subscription ended before readiness'); record.active = true; void pump(record) },
    remove,
    notify(channel) { for (const record of channels.get(channel) ?? []) enqueue(record, channel) },
    resync() { for (const record of records) enqueue(record) },
    channels: () => [...channels.keys()],
    close() { if (closed) return; closed = true; for (const record of [...records]) remove(record, true) },
  }
}

/** Explicit deterministic local fake; it does not simulate durable delivery. */
export function createMemoryInvalidationBus(options: InvalidationBounds = {}): MemoryInvalidationBus {
  const listeners = createInvalidationListeners(options)
  let closed = false
  return {
    get status() { return closed ? 'closed' : 'ready' },
    async publish(channel) { if (closed) throw new InvalidationError('invalidation_closed', 'Invalidation bus is closed'); channelName(channel); const subscribed = listeners.channels().includes(channel); listeners.notify(channel); return { subscriberConnections: subscribed ? 1 : 0 } },
    async subscribe(input) { const record = listeners.add(input); listeners.activate(record); return () => listeners.remove(record) },
    resync() { if (!closed) listeners.resync() },
    async close() { if (closed) return; closed = true; listeners.close() },
  }
}
