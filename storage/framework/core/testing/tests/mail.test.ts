import { afterEach, describe, expect, it } from 'bun:test'
import { CaptureEmailDriver } from '@stacksjs/email/drivers/capture'
import { emailsTo, lastEmail, mailFake, mailIsFaked, restoreMail, sentEmails } from '../src/mail'

afterEach(() => {
  restoreMail()
  CaptureEmailDriver.clear()
})

describe('mailFake', () => {
  it('captures a send instead of transporting it', async () => {
    mailFake()
    const { mail } = await import('@stacksjs/email')
    await mail.send({ to: 'a@b.com', subject: 'Welcome', text: 'hi' })

    expect(sentEmails()).toHaveLength(1)
    expect(lastEmail()?.subject).toBe('Welcome')
  })

  it('starts each fake from an empty store', async () => {
    mailFake()
    const { mail } = await import('@stacksjs/email')
    await mail.send({ to: 'a@b.com', subject: 'One', text: 'hi' })
    restoreMail()

    mailFake()
    // Otherwise the previous test's mail reads as this test's.
    expect(sentEmails()).toHaveLength(0)
  })

  it('matches a recipient across to, cc and bcc', async () => {
    mailFake()
    const { mail } = await import('@stacksjs/email')
    await mail.send({ to: 'a@b.com', subject: 'To', text: 'hi' })
    await mail.send({ to: 'x@y.com', cc: ['a@b.com'], subject: 'Cc', text: 'hi' })
    await mail.send({ to: 'x@y.com', bcc: ['a@b.com'], subject: 'Bcc', text: 'hi' })
    await mail.send({ to: 'x@y.com', subject: 'Neither', text: 'hi' })

    expect(emailsTo('a@b.com').map(m => m.subject)).toEqual(['To', 'Cc', 'Bcc'])
  })

  it('throws rather than returning [] when nothing is capturing', () => {
    // An empty array here reads as "no email was sent", which is exactly the
    // wrong conclusion.
    expect(() => sentEmails()).toThrow(/without mailFake\(\)/)
  })

  it('is idempotent, so a second call does not lose the driver to restore', () => {
    mailFake()
    mailFake()
    restoreMail()
    expect(mailIsFaked()).toBe(false)
  })

  it('restores quietly when no fake is active', () => {
    expect(() => restoreMail()).not.toThrow()
  })
})
