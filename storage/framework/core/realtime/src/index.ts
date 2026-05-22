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
export { setBunSocket, handleWebSocketRequest, storeWebSocketEvent } from './ws'
// WebSocket authenticator wiring (stacksjs/stacks#1877 R-1). Install
// once at server boot to require a valid token / cookie at the
// handshake boundary — without it, the upgrade proceeds unauthed.
export { setWsAuthenticator, getWsAuthenticator } from './ws'
export type { WsAuthenticator, WsAuthResult } from './ws'
