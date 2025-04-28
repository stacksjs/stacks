export type ChatConfig = ChatOptions

// Chat Message Types

/**
 * Configuration options for chat drivers
 */
export interface ChatDriverConfig {
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number

  /**
   * Timeout between retry attempts in milliseconds
   */
  retryTimeout?: number

  /**
   * Any additional driver-specific configuration
   */
  [key: string]: any
}

/**
 * Base chat message interface
 */
export interface ChatMessage {
  /**
   * Recipient(s) of the message
   * This could be channel ID, user ID, or other identifier
   */
  to: string | string[]

  /**
   * Optional sender information
   */
  from?: {
    id?: string
    name?: string
    avatar?: string
  }

  /**
   * Optional message subject or title
   */
  subject?: string

  /**
   * Message content in plain text
   */
  content?: string

  /**
   * Template to be used for rendering the message
   */
  template?: string

  /**
   * Template data
   */
  data?: Record<string, any>

  /**
   * Any attachments to include with the message
   */
  attachments?: ChatAttachment[]

  /**
   * Callback triggered on successful message delivery
   */
  onSuccess?: () => void | Promise<void> | Partial<ChatResult>

  /**
   * Callback triggered on message delivery failure
   */
  onError?: (error: Error) => void | Promise<void> | Partial<ChatResult>

  /**
   * General handler for both success and error cases
   */
  handle?: () => void | Promise<void> | Partial<ChatResult>

  /**
   * Custom fields for platform-specific options
   */
  [key: string]: any
}

/**
 * Structure for message attachments
 */
export interface ChatAttachment {
  /**
   * Filename of the attachment
   */
  filename: string

  /**
   * Content of the attachment
   */
  content: string | Uint8Array

  /**
   * MIME type of the attachment
   */
  contentType: string

  /**
   * Additional options for the attachment
   */
  options?: Record<string, any>
}

/**
 * Standard result object for chat operations
 */
export interface ChatResult {
  /**
   * Indicates whether the operation was successful
   */
  success: boolean

  /**
   * Human-readable message about the result
   */
  message: string

  /**
   * Name of the provider that handled the message
   */
  provider: string

  /**
   * Optional message ID returned from the provider
   */
  messageId?: string

  /**
   * Any additional provider-specific response data
   */
  data?: Record<string, any>
}

/**
 * Chat driver options
 */
export type ChatOptions = Record<string, any>

/**
 * Base chat driver interface
 */
export interface ChatDriver {
  /**
   * Name of the chat provider
   */
  name: string

  /**
   * Configure the driver
   */
  configure: (config: ChatDriverConfig) => void

  /**
   * Send a message
   */
  send: (message: ChatMessage, options?: ChatOptions) => Promise<ChatResult>
}

/**
 * Slack-specific response
 */
export interface SlackResponse {
  /**
   * ID of the sent message
   */
  id: string

  /**
   * Channel where the message was sent
   */
  channel?: string

  /**
   * Timestamp of the message
   */
  ts?: string

  /**
   * Any additional response data
   */
  [key: string]: any
}
