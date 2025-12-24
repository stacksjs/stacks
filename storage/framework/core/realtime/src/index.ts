/**
 * Stacks Realtime Module
 *
 * This module provides real-time broadcasting capabilities for Stacks applications.
 * It's built on top of ts-broadcasting and provides a familiar Laravel-like API.
 */

// Re-export everything from ts-broadcasting
export * from 'ts-broadcasting'

// Re-export specific commonly used classes and functions
export {
  BroadcastServer,
  type ServerConfig,
  Broadcaster,
  AnonymousEvent,
  createEvent,
  ChannelManager,
  BroadcastClient,
  Client,
  Echo,
  BroadcastHelpers,
  createHelpers,
  RedisAdapter,
  // Facade and global helpers (Laravel-style API)
  Broadcast,
  broadcast as broadcastEvent,
  broadcastToUser,
  broadcastToUsers,
  channel as defineChannel,
  // Middleware
  AuthenticationManager,
  RateLimiter,
  SecurityManager,
  MessageValidationManager,
  MonitoringManager,
  // Advanced features
  EncryptionManager,
  WebhookManager,
  PersistenceManager,
  PresenceHeartbeatManager,
  AcknowledgmentManager,
  BatchOperationsManager,
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerManager,
  LoadManager,
  MessageDeduplicator,
  PrometheusExporter,
  BroadcastQueueManager,
  BroadcastJob,
  DelayedBroadcastJob,
  RecurringBroadcastJob,
} from 'ts-broadcasting'

// Re-export types
export type {
  BroadcastConfig,
  ConnectionConfig,
  ConnectionOptions,
  WebSocketData,
  User,
  ChannelType,
  Channel,
  PrivateChannel as PrivateChannelType,
  PresenceChannel as PresenceChannelType,
  PresenceMember,
  BroadcastEvent,
  BroadcastMessage,
  QueueConfig,
  ChannelAuthCallback,
} from 'ts-broadcasting'

// Server instance management
export { getServer, setServer, createServer, stopServer } from './server-instance'

// Stacks-specific exports
export { emit, emitToUser, emitToUsers } from './emit'
export type { EmitOptions } from './emit'
export { channel as createChannel, Channel as StacksChannel } from './channel'
export { broadcast as dispatchBroadcast, runBroadcast, Broadcast as LegacyBroadcast } from './broadcast'
export type { BroadcastInstance } from './broadcast'
export { setBunSocket, handleWebSocketRequest, storeWebSocketEvent } from './ws'
