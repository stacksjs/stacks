import type { RequestInstance } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { inboxMailboxPath, InvalidInboxMailboxError } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { defaultMailbox } from './mail-preference'

function configuredMailDomain(): string {
  const email = (config as any)?.email || {}
  const fromAddress = String(email.from?.address || '').trim()
  const fromDomain = fromAddress.includes('@') ? fromAddress.split('@').at(-1) : ''
  return String(email.domain || fromDomain || 'stacksjs.com').trim().toLowerCase()
}

export function dashboardMailbox(request: RequestInstance): string {
  const value = request.get('mailbox')
  if (value !== null && value !== undefined && typeof value !== 'string')
    throw new InvalidInboxMailboxError()

  return inboxMailboxPath(value?.trim() || defaultMailbox(), configuredMailDomain()).address
}

export function inboxActionError(error: unknown, fallback: string): Response {
  if (error instanceof InvalidInboxMailboxError) {
    return response.json({
      message: 'Enter a mailbox on the configured email domain.',
      fields: { mailbox: 'Enter a mailbox on the configured email domain.' },
    }, 422)
  }

  return response.json({
    message: fallback,
  }, 503)
}
