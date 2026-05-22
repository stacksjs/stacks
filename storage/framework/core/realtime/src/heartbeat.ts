/**
 * Server-side WebSocket heartbeat (stacksjs/stacks#1877 R-5).
 *
 * Background: a half-closed socket (network cable pulled, idle NAT
 * timeout, mobile client lost connection without sending FIN) lingers
 * in the server's memory until the OS surfaces the close. On long-running
 * servers behind NAT — exactly the production deployment shape — these
 * accumulate as "ghost" subscribers that the broadcast loop still tries
 * to write to.
 *
 * Fix: opt-in heartbeat that pings every `intervalMs`, tracks the last
 * pong timestamp per socket, and closes any socket that misses
 * `maxMissedPongs` consecutive cycles. Defaults: 30s interval, 2 missed
 * pongs = 90s effective deadline. Apps install via
 * `setHeartbeatConfig({...})` once at boot.
 *
 * Limitation: ts-broadcasting owns the socket lifecycle. We can detect
 * dead sockets but the underlying server has to honor a close call.
 * The default `onDead` handler tries `socket.close()` if available;
 * apps can override to do harder cleanup.
 */

import { log } from '@stacksjs/logging'
import { getServer } from './server-instance'

export interface HeartbeatConfig {
  /** Ping interval in milliseconds. Default: 30s. */
  intervalMs?: number
  /**
   * Maximum consecutive missed pongs before declaring the socket
   * dead and calling `onDead`. Default: 2.
   */
  maxMissedPongs?: number
  /**
   * Called when a socket misses `maxMissedPongs` pings in a row.
   * Default action: try `socket.close()`. Install a custom handler
   * to drop the socket from per-channel sets, emit a metric, etc.
   */
  onDead?: (socket: unknown) => void
}

interface HeartbeatState {
  intervalMs: number
  maxMissedPongs: number
  onDead: (socket: unknown) => void
  /** Map<socket, missed-pong-count> */
  missed: WeakMap<object, number>
  timer: ReturnType<typeof setInterval> | null
}

let state: HeartbeatState | null = null

/**
 * Install (or replace) the heartbeat config. Pass `null` to stop
 * the heartbeat loop. Safe to call multiple times — the previous
 * timer is cleared before the new one starts.
 */
export function setHeartbeatConfig(cfg: HeartbeatConfig | null): void {
  if (state?.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
  if (!cfg) {
    state = null
    return
  }

  const intervalMs = cfg.intervalMs ?? 30_000
  const maxMissedPongs = cfg.maxMissedPongs ?? 2
  const onDead = cfg.onDead ?? defaultOnDead

  state = {
    intervalMs,
    maxMissedPongs,
    onDead,
    missed: new WeakMap(),
    timer: null,
  }

  state.timer = setInterval(() => {
    if (!state) return
    runOneTick()
  }, intervalMs)
  ;(state.timer as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
}

/** Read the current config — useful for tests. */
export function getHeartbeatConfig(): Readonly<HeartbeatState> | null {
  return state
}

/**
 * Manually fire a single heartbeat tick. Exposed for tests; in
 * production it's invoked by the internal interval.
 */
export function runOneTick(): void {
  if (!state) return
  const server = getServer()
  if (!server) return

  // Collect every active socket across all channels. ts-broadcasting
  // exposes them under different property names by version; probe
  // both `channels` and `clients` (already done by hasSubscribers and
  // checkBackpressure — same iteration pattern).
  const allSockets = collectSockets(server)

  for (const socket of allSockets) {
    const ws = socket as { send?: (data: string) => void, ping?: () => void, close?: (code?: number, reason?: string) => void }
    const missed = state.missed.get(socket) ?? 0

    if (missed >= state.maxMissedPongs) {
      log.warn(`[realtime] socket missed ${missed} pongs — declaring dead`)
      try {
        state.onDead(socket)
      }
      catch (err) {
        log.warn(`[realtime] heartbeat onDead handler threw: ${err instanceof Error ? err.message : String(err)}`)
      }
      state.missed.delete(socket as object)
      continue
    }

    // Bump the missed counter BEFORE sending the ping — when the
    // client pongs back, `markPong` resets it to 0. If the client
    // never replies, the counter grows tick-by-tick until we
    // declare it dead above.
    state.missed.set(socket as object, missed + 1)

    try {
      if (typeof ws.ping === 'function') {
        ws.ping()
      }
      else if (typeof ws.send === 'function') {
        // Fallback for sockets without a native ping helper —
        // send an application-level heartbeat frame the client
        // can pong via the same mechanism.
        ws.send('__stacks_ping__')
      }
    }
    catch {
      // Send threw — socket is likely already broken. Mark dead next tick.
    }
  }
}

/**
 * Called from the server's pong handler (or message handler when
 * fallback `__stacks_ping__` text frames are in use). Resets the
 * missed-pong counter for the given socket so it doesn't get
 * declared dead.
 */
export function markPong(socket: object): void {
  if (!state) return
  state.missed.delete(socket)
}

function collectSockets(server: unknown): object[] {
  const out = new Set<object>()
  try {
    const channels = (server as { channels?: unknown, clients?: unknown }).channels
      ?? (server as { channels?: unknown, clients?: unknown }).clients
    if (channels && typeof (channels as { values?: () => Iterable<unknown> }).values === 'function') {
      for (const set of (channels as { values: () => Iterable<unknown> }).values()) {
        if (set && typeof (set as { [Symbol.iterator]: unknown })[Symbol.iterator] === 'function') {
          for (const entry of set as Iterable<unknown>) {
            const ws = (entry && typeof entry === 'object' && 'ws' in entry) ? (entry as { ws: object }).ws : entry
            if (ws && typeof ws === 'object') out.add(ws as object)
          }
        }
      }
    }
  }
  catch {
    // Introspection failed — same fallthrough policy as backpressure
    // guard / hasSubscribers. Heartbeat is best-effort.
  }
  return [...out]
}

function defaultOnDead(socket: unknown): void {
  const ws = socket as { close?: (code?: number, reason?: string) => void }
  if (typeof ws.close === 'function')
    ws.close(1011, 'heartbeat timeout')
}
