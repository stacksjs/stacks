/**
 * Per-channel message replay buffer (stacksjs/stacks#1877 R-3).
 *
 * Background: ts-broadcasting delivers messages at-most-once — a client
 * that drops between two broadcasts loses everything in flight. For
 * channels where the app needs every message (chat, presence, order
 * updates), reconnect-after-network-blip becomes a silent data loss.
 *
 * Fix: opt-in per-channel ring buffer that retains the most-recent N
 * messages with monotonic sequence IDs. On reconnect, the client sends
 * its last-seen seq; the server replays everything stored after that
 * point. Apps install via `setReplayBuffer({ channels, maxPerChannel,
 * ttlMs })`. Buffer is in-process — for cross-instance replay, route
 * through a shared store (Redis Streams, Postgres LISTEN/NOTIFY, etc.).
 *
 * Memory shape: `Map<channel, RingBuffer<BufferedMessage>>`. Bounded by
 * `maxPerChannel` (default 100) so a chatty channel can't OOM the
 * server. Entries past `ttlMs` are evicted lazily on read — apps that
 * want eager eviction can call `pruneExpired()` from their own timer.
 */

export interface ReplayBufferConfig {
  /**
   * Glob-ish channel-name patterns to buffer. `'*'` buffers every
   * channel; `'orders.*'` buffers channels matching that prefix. The
   * empty array (default) disables buffering for all channels.
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

/**
 * Returns true if the configured patterns cover `channel`. Pattern
 * matching is glob-ish: `*` matches any channel; otherwise a literal
 * prefix ending in `.*` (e.g. `orders.*`) matches any channel
 * starting with that prefix.
 */
function shouldBuffer(channel: string): boolean {
  if (!registry || registry.channels.length === 0) return false
  for (const pattern of registry.channels) {
    if (pattern === '*') return true
    if (pattern === channel) return true
    if (pattern.endsWith('.*') && channel.startsWith(pattern.slice(0, -1))) return true
  }
  return false
}

/**
 * Called by the broadcast wrapper for every outbound message on a
 * matched channel. Records the message and assigns a monotonic seq.
 * Returns the seq for the caller to optionally include in the
 * outbound payload — clients store the latest seq locally and send
 * it back on reconnect via `replaySince`.
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
 * Replay every buffered message on `channel` with `seq > sinceSeq`.
 * Stale entries (older than `ttlMs`) are evicted on the way through
 * so callers don't see them. Returns the array of messages the
 * caller should re-send to the reconnecting client.
 *
 * @example
 * ```ts
 * // Inside the reconnect handler:
 * const missed = replaySince('orders', lastSeenSeq)
 * for (const msg of missed) {
 *   socket.send(JSON.stringify({ event: msg.event, data: msg.data, seq: msg.seq }))
 * }
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

