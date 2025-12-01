/**
 * Stacks Mail Server
 * 
 * Serverless mail system with:
 * - Lambda + API Gateway for mail operations
 * - S3 for email storage
 * - SES for sending
 * - Local IMAP proxy for Mail.app connectivity
 */

export { ImapProxy } from './proxy/imap-proxy'
export * from './api/handlers'

// Re-export for backwards compatibility
export { ImapProxy as ImapServer } from './proxy/imap-proxy'
