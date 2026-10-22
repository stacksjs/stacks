import { afterAll, describe, expect, it, spyOn } from 'bun:test'
import { mail } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { FailedJobNotifier } from '../src/notifications'

/**
 * The failed-job alert reports an undelivered email (stacksjs/stacks#2930).
 *
 * It called `mail.send()` inside a `try`/`catch`, and `send()` resolves with
 * `{ success: false }` rather than throwing, so an alert that never left the
 * building was indistinguishable from one that did.
 */
const internals = mail as unknown as { drivers: Map<string, unknown>, defaultDriver: string }
const previousDriver = internals.defaultDriver
internals.drivers.set('undeliverable', {
  name: 'undeliverable',
  send: async () => ({ success: false, message: 'Email sending failed: getaddrinfo ENOTFOUND mailpit', provider: 'undeliverable' }),
})

afterAll(() => {
  internals.defaultDriver = previousDriver
  internals.drivers.delete('undeliverable')
})

describe('failed-job email notifications', () => {
  it('logs the delivery failure instead of treating the alert as sent', async () => {
    internals.defaultDriver = 'undeliverable'
    const errors = spyOn(log, 'error')
    try {
      const notifier = new FailedJobNotifier({ channels: ['email'], email: { to: 'ops@example.org' } })
      await notifier.notify({ id: 'job-1', name: 'SendNewsletter', queue: 'default', error: 'boom', attempts: 3, failedAt: new Date() } as never)

      const reported = errors.mock.calls.find(call => String(call[0]).includes('Failed to send email notification'))
      expect(reported).toBeDefined()
      expect(String((reported![1] as Error)?.message ?? reported![1])).toContain('ENOTFOUND')
    }
    finally {
      errors.mockRestore()
      internals.defaultDriver = previousDriver
    }
  })
})
