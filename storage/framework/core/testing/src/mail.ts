import type { CapturedMessage } from '@stacksjs/email'
import { afterEach } from 'bun:test'
// Both from the barrel, deliberately. Reaching the driver through
// `@stacksjs/email/drivers/capture` gets a different module - and therefore a
// different capture store - than the `mail` singleton writes to.
import { CaptureEmailDriver, mail } from '@stacksjs/email'

/**
 * Mail fakes for tests (stacksjs/stacks#2581).
 *
 * `docs/testing/mocking.md` documented a `MockMailer` class that never
 * existed. What exists is the `capture` driver, which already records every
 * message in memory with no socket and no disk - it was simply never reachable
 * without editing config by hand and hoping the singleton had not been
 * constructed yet.
 *
 * So this is not a new mock. It is the switch that turns the real one on, and
 * the `afterEach` that turns it back off.
 */

/** `null` when no fake is installed; otherwise the driver to restore. */
let previousDriver: string | null = null

/**
 * Send every email into memory instead of a transport.
 *
 * Redirects the shared `mail` singleton - the one the code under test uses -
 * and clears anything a previous test captured.
 */
export function mailFake(): void {
  if (previousDriver !== null)
    return
  previousDriver = mail.fake()
  CaptureEmailDriver.clear()
}

/** Whether a mail fake is currently installed. */
export function mailIsFaked(): boolean {
  return previousDriver !== null
}

/**
 * Every message sent since `mailFake()`, oldest first.
 *
 * A copy, so a test holding the result across further sends sees what it
 * asked for.
 */
export function sentEmails(): CapturedMessage[] {
  if (previousDriver === null) {
    throw new Error(
      'sentEmails() was called without mailFake(). '
      + 'Nothing is capturing, so an empty result would look like "no email was sent".',
    )
  }
  return [...CaptureEmailDriver.all()]
}

/** The most recent message, or `undefined` if none was sent. */
export function lastEmail(): CapturedMessage | undefined {
  return sentEmails().at(-1)
}

/** Messages addressed to `address`, matching any of to/cc/bcc. */
export function emailsTo(address: string): CapturedMessage[] {
  const matches = (field: CapturedMessage['to'] | undefined): boolean => {
    if (field === undefined || field === null)
      return false
    const list = Array.isArray(field) ? field : [field]
    return list.some(entry => (typeof entry === 'string' ? entry : entry?.address) === address)
  }
  return sentEmails().filter(message => matches(message.to) || matches(message.cc) || matches(message.bcc))
}

/** Put the real transport back and drop what was captured. */
export function restoreMail(): void {
  if (previousDriver === null)
    return
  mail.restoreDriver(previousDriver)
  previousDriver = null
  CaptureEmailDriver.clear()
}

// A test that faked mail and did not restore would silently swallow the next
// test's email - and a swallowed email looks exactly like one that was never
// sent.
afterEach(() => {
  restoreMail()
})
