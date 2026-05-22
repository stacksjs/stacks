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
export { channel as createChannel, Channel as StacksChannel } from './channel'
export { broadcast as dispatchBroadcast, runBroadcast, Broadcast as LegacyBroadcast } from './broadcast'
export type { BroadcastInstance } from './broadcast'
// Backpressure guard for slow consumers (stacksjs/stacks#1877 R-2).
// Opt-in via setBackpressureGuard; default is no-op.
export { setBackpressureGuard, getBackpressureGuard } from './broadcast'
export type { BackpressureGuardConfig } from './broadcast'

// Heartbeat ping/pong for detecting half-closed sockets
// (stacksjs/stacks#1877 R-5). Opt-in via setHeartbeatConfig.
export { getHeartbeatConfig, markPong, runOneTick, setHeartbeatConfig } from './heartbeat'
export type { HeartbeatConfig } from './heartbeat'

// At-least-once replay buffer for reconnect (stacksjs/stacks#1877 R-3).
// Opt-in via setReplayBuffer. Apps wire `replaySince(channel, seq)`
// into their reconnect handler to re-send missed messages.
export { debugSnapshot, getReplayBuffer, pruneExpired, recordBroadcast, replaySince, setReplayBuffer } from './replay-buffer'
export type { BufferedMessage, ReplayBufferConfig } from './replay-buffer'
export { setBunSocket, handleWebSocketRequest, storeWebSocketEvent } from './ws'
// WebSocket authenticator wiring (stacksjs/stacks#1877 R-1). Install
// once at server boot to require a valid token / cookie at the
// handshake boundary — without it, the upgrade proceeds unauthed.
export { setWsAuthenticator, getWsAuthenticator } from './ws'
export type { WsAuthenticator, WsAuthResult } from './ws'
