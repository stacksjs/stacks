/**
 * Per-channel message replay buffer (stacksjs/stacks#1877 R-3).
 *
 * Background: ts-broadcasting delivers messages at-most-once — a client
 * that drops between two broadcasts loses everything in flight. For
 * channels where the app needs every message (chat, presence, order
 * updates), reconnect-after-network-blip becomes a silent data loss.
 *
 * Fix: opt-in per-channel ring buffer that retains the most-recent N
 * messages with monotonic sequence IDs. Every broadcast on a buffered
 * channel - whichever API sent it - is recorded through the hook
 * `setServer()` installs on the server, and reaches clients with its
 * sequence number as a top-level field: `{ event, channel, data, seq }`.
 * A client keeps the last `seq` it saw per channel; on reconnect it
 * sends that back (through a route or action of the app's), and the app
 * re-sends `replaySince(channel, seq)`. Apps install via
 * `setReplayBuffer({ channels, maxPerChannel, ttlMs })`. Buffer is
 * in-process, and so are the sequence numbers - with several instances
 * behind Redis each numbers its own copy, so route replay through a
 * shared store (Redis Streams, Postgres LISTEN/NOTIFY, etc.) there.
 *
 * Memory shape: `Map<channel, RingBuffer<BufferedMessage>>`. Bounded by
 * `maxPerChannel` (default 100) so a chatty channel can't OOM the
 * server. Entries past `ttlMs` are evicted lazily on read — apps that
 * want eager eviction can call `pruneExpired()` from their own timer.
 */

export interface ReplayBufferConfig {
  /**
   * Glob-ish channel-name patterns to buffer. `'*'` buffers every
   * channel; `'orders.*'` buffers channels matching that prefix. A
   * pattern matches the name with or without its `private-` /
   * `presence-` prefix, so `'orders.*'` covers `private-orders.1` -
   * the name `emit(..., { private: true })` and `channel().private()`
   * send on. The empty array (default) disables buffering for all
   * channels.
   */
  channels?: string[]
  /**
   * Maximum messages retained per channel. Older entries are evicted
   * FIFO. Default: 100.
   */
  maxPerChannel?: number
  /**
   * Max age (milliseconds) of any buffered message. Entries older
   * than this are evicted lazily on read. Default: 5 minutes.
   */
  ttlMs?: number
}

export interface BufferedMessage {
  /** Monotonic per-channel sequence id. Starts at 1. */
  seq: number
  /** Wall-clock timestamp when the message was recorded. */
  ts: number
  /** Event name from `server.broadcast(channel, event, data)`. */
  event: string
  /** Payload from the broadcast — opaque to the buffer. */
  data: unknown
}

interface ChannelState {
  /** Ring buffer of recent messages (head = oldest). */
  messages: BufferedMessage[]
  /** Next sequence id to assign. */
  nextSeq: number
}

interface BufferRegistry {
  channels: string[]
  maxPerChannel: number
  ttlMs: number
  state: Map<string, ChannelState>
}

let registry: BufferRegistry | null = null

/**
 * Install (or replace) the replay-buffer config. Pass `null` to disable
 * and drop all buffered state. Safe to call multiple times.
 */
export function setReplayBuffer(cfg: ReplayBufferConfig | null): void {
  if (!cfg) {
    registry = null
    return
  }
  registry = {
    channels: cfg.channels ?? [],
    maxPerChannel: cfg.maxPerChannel ?? 100,
    ttlMs: cfg.ttlMs ?? 5 * 60_000,
    state: new Map(),
  }
}

/** Read the current config — useful for tests. */
export function getReplayBuffer(): Readonly<BufferRegistry> | null {
  return registry
}

function matches(pattern: string, channel: string): boolean {
  if (pattern === '*' || pattern === channel) return true
  return pattern.endsWith('.*') && channel.startsWith(pattern.slice(0, -1))
}

/**
 * Returns true if the configured patterns cover `channel`. Pattern
 * matching is glob-ish: `*` matches any channel; otherwise a literal
 * prefix ending in `.*` (e.g. `orders.*`) matches any channel
 * starting with that prefix. Each pattern is tried against the full
 * name and against it without a `private-` / `presence-` prefix:
 * matching only the full name, `orders.*` missed `private-orders.1`.
 */
function shouldBuffer(channel: string): boolean {
  if (!registry || registry.channels.length === 0) return false
  const bare = channel.replace(/^(?:private|presence)-/, '')
  return registry.channels.some(pattern => matches(pattern, channel) || matches(pattern, bare))
}

/**
 * Called for every outbound broadcast by the hook `setServer()`
 * installs. Records the message under its full channel name (the one
 * clients subscribe to) and assigns a monotonic seq, which the hook
 * stamps onto the outbound frame as `seq`. Returns null for a channel
 * no pattern covers.
 */
export function recordBroadcast(channel: string, event: string, data: unknown): number | null {
  if (!registry || !shouldBuffer(channel)) return null

  let state = registry.state.get(channel)
  if (!state) {
    state = { messages: [], nextSeq: 1 }
    registry.state.set(channel, state)
  }

  const msg: BufferedMessage = {
    seq: state.nextSeq++,
    ts: Date.now(),
    event,
    data,
  }
  state.messages.push(msg)

  // FIFO eviction past the size cap. Splicing from the front is O(n)
  // but maxPerChannel is bounded (default 100) so this stays cheap.
  if (state.messages.length > registry.maxPerChannel)
    state.messages.splice(0, state.messages.length - registry.maxPerChannel)

  return msg.seq
}

/**
 * Replay every buffered message on `channel` (the full name, e.g.
 * `private-orders.1`) with `seq > sinceSeq`. Stale entries (older than
 * `ttlMs`) are evicted on the way through so callers don't see them.
 * Returns the array of messages the caller should re-send to the
 * reconnecting client.
 *
 * @example
 * ```ts
 * // The client kept `message.seq` from the last frame it received on
 * // the channel and sends it back after reconnecting, e.g. to a route:
 * const missed = replaySince('private-orders.1', lastSeenSeq)
 * return missed.map(msg => ({ event: msg.event, channel: 'private-orders.1', data: msg.data, seq: msg.seq }))
 * ```
 */
export function replaySince(channel: string, sinceSeq: number): BufferedMessage[] {
  if (!registry) return []
  const state = registry.state.get(channel)
  if (!state) return []

  const now = Date.now()
  const ttl = registry.ttlMs
  // Lazy TTL eviction — drop expired messages from the head.
  while (state.messages.length > 0 && now - state.messages[0]!.ts > ttl)
    state.messages.shift()

  if (state.messages.length === 0) return []
  // Binary-search would be marginally faster; linear is fine at
  // maxPerChannel=100 and clearer for the buffer's volume.
  return state.messages.filter(m => m.seq > sinceSeq)
}

/**
 * Drop expired entries across every tracked channel. Called by apps
 * that want eager memory reclaim — the default lazy-on-read path is
 * adequate for most workloads.
 */
export function pruneExpired(): void {
  if (!registry) return
  const now = Date.now()
  const ttl = registry.ttlMs
  for (const state of registry.state.values()) {
    while (state.messages.length > 0 && now - state.messages[0]!.ts > ttl)
      state.messages.shift()
  }
}

/**
 * Snapshot the buffer state — debugging only. Don't depend on this
 * shape in production code; the internals may change.
 */
export function debugSnapshot(): Record<string, { count: number, firstSeq: number | null, lastSeq: number | null }> {
  const out: Record<string, { count: number, firstSeq: number | null, lastSeq: number | null }> = {}
  if (!registry) return out
  for (const [ch, state] of registry.state) {
    out[ch] = {
      count: state.messages.length,
      firstSeq: state.messages[0]?.seq ?? null,
      lastSeq: state.messages[state.messages.length - 1]?.seq ?? null,
    }
  }
  return out
}

