import type { RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import {
  dashboardMailbox,
  inboxActionError,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Email/inbox-request'

function request(mailbox?: unknown): RequestInstance {
  return {
    get(key: string) {
      return key === 'mailbox' ? mailbox : undefined
    },
  } as RequestInstance
}

describe('dashboard inbox mailbox contract', () => {
  test('normalizes configured mailbox addresses', () => {
    expect(dashboardMailbox(request('CHRIS@STACKSJS.COM'))).toBe('chris@stacksjs.com')
    expect(dashboardMailbox(request('chris'))).toBe('chris@stacksjs.com')
  })

  test('rejects mailboxes outside the configured domain', async () => {
    let error: unknown
    try {
      dashboardMailbox(request('chris@example.com'))
    }
    catch (caught) {
      error = caught
    }

    const result = inboxActionError(error, 'Inbox messages could not be loaded.')
    expect(result.status).toBe(422)
    expect(await result.json()).toEqual({
      message: 'Enter a mailbox on the configured email domain.',
      fields: { mailbox: 'Enter a mailbox on the configured email domain.' },
    })
  })

  test('rejects non-string mailbox input', () => {
    expect(() => dashboardMailbox(request({ domain: 'stacksjs.com' }))).toThrow()
  })

  test('keeps operational failures distinct from invalid input', async () => {
    const result = inboxActionError(new Error('Storage unavailable.'), 'Inbox messages could not be loaded.')
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ message: 'Inbox messages could not be loaded.' })
  })
})
