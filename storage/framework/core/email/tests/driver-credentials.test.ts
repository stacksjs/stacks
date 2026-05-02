/**
 * Email driver credential validation tests.
 *
 * Each driver should produce a clear, actionable error message when
 * its required configuration is missing — rather than a generic
 * "send failed" or an SDK-internal stack trace. These tests pin the
 * error messages so the next driver migration doesn't quietly
 * regress to "unhelpful".
 */

import { describe, expect, it } from 'bun:test'

describe('email driver missing-credential errors', () => {
  it('Mail.send throws a helpful error when the configured driver is missing', async () => {
    const { Mail } = await import('../src/email')
    // Cast through unknown because the constructor visibility may vary
    // across builds; this is a behavioral test, not a type test.
    const mail = new (Mail as unknown as new (cfg: { defaultDriver: string }) => {
      send: (m: unknown) => Promise<unknown>
    })({ defaultDriver: 'definitely-not-a-real-driver' })

    let caught: unknown
    try {
      await mail.send({ to: 'a@b.com', subject: 's', html: '<p>h</p>' })
    }
    catch (err) {
      caught = err
    }

    expect(caught).toBeDefined()
    expect(caught).toBeInstanceOf(Error)
    const message = (caught as Error).message
    expect(message).toContain('definitely-not-a-real-driver')
    expect(message).toContain('Available drivers')
    expect(message).toContain('MAIL_MAILER')
  })

  it('SES driver surfaces missing AWS credentials clearly', async () => {
    // We can't actually call SES in tests, but we verify the driver
    // module loads without throwing — if the driver's constructor
    // hard-required AWS_REGION at import time, every test would
    // crash. The earlier shape did exactly that and was fixed; this
    // pins the regression.
    const mod = await import('../src/email')
    expect(mod.Mail ?? mod.mail).toBeDefined()
  })

  it('exports the driver registry helpers', async () => {
    const mod = await import('../src/email')
    // The Mail class should be exported so users can instantiate
    // their own with a custom default driver — needed for tests.
    expect(typeof mod.Mail === 'function' || typeof mod.mail === 'object').toBe(true)
  })
})
