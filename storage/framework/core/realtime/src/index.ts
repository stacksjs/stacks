/**
 * Stacks Realtime Module
 *
 * This module provides real-time broadcasting capabilities for Stacks applications.
 * It's built on top of ts-broadcasting and provides a familiar Laravel-like API.
 */

// Re-export everything from ts-broadcasting
export * from 'ts-broadcasting'

// Note: all exports are already provided by `export * from 'ts-broadcasting'` above.
// Aliases are provided below for convenience.

// Server instance management
export { getServer, setServer, createServer, stopServer } from './server-instance'

// Stacks-specific exports
export { emit, emitToUser, emitToUsers } from './emit'
export type { EmitOptions } from './emit'
export { channel, channel as createChannel, Channel as StacksChannel } from './channel'
export { broadcast as dispatchBroadcast, runBroadcast, Broadcast as LegacyBroadcast } from './broadcast'
export type { BroadcastInstance } from './broadcast'
// Dead-socket detection and slow-consumer handling are the broadcast
// server's own: pass `websocket: { idleTimeout, sendPings,
// backpressureLimit, closeOnBackpressureLimit }` to `createServer()`.

// At-least-once replay buffer for reconnect (stacksjs/stacks#1877 R-3).
// Opt-in via setReplayBuffer. Every broadcast on a buffered channel is
// recorded and carries a top-level `seq`; apps wire `replaySince(channel,
// seq)` into their reconnect handling to re-send missed messages.
export { debugSnapshot, getReplayBuffer, pruneExpired, recordBroadcast, replaySince, setReplayBuffer } from './replay-buffer'
export type { BufferedMessage, ReplayBufferConfig } from './replay-buffer'
export { storeWebSocketEvent } from './ws'
// WebSocket authenticator (stacksjs/stacks#1877 R-1). Gates every upgrade
// on the server `createServer()` starts; without one, upgrades proceed
// unauthed.
export { setWsAuthenticator, getWsAuthenticator } from './ws'
export type { WsAuthenticator, WsAuthResult } from './ws'
