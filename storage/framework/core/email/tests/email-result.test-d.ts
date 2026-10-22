import type { EmailFailed, EmailResult, EmailSent } from '@stacksjs/types'
import type { Mail } from '../src/email'

/**
 * `send()` and `sendOrFail()` are told apart by their types (stacksjs/stacks#2930).
 *
 * Both used to resolve with one `EmailResult` whose `success` was a bare
 * boolean, so nothing at a call site said that `send()` resolves with a failure
 * instead of throwing. A caller counting "no exception" as delivered recorded a
 * newsletter as sent while the SMTP host was unreachable.
 */
declare const mail: Mail
declare const message: Parameters<Mail['send']>[0]

// The union `send()` resolves with is exactly these two.
const union: EmailResult extends EmailSent | EmailFailed ? true : false = true

// sendOrFail only ever resolves with a delivery the provider accepted.
const delivered = await mail.sendOrFail(message)
const accepted: true = delivered.success
const sent: EmailSent = delivered

// send() may have failed, so its result cannot be treated as sent without
// narrowing on `success`.
const outcome = await mail.send(message)
// @ts-expect-error send() resolves with a failure as well as a success
const assumed: true = outcome.success
// @ts-expect-error a result is not known to be sent until `success` is checked
const unchecked: EmailSent = outcome

if (outcome.success) {
  const ok: EmailSent = outcome
  void ok
}
else {
  const failed: EmailFailed = outcome
  // A failure carries no message id to record as delivered.
  const id: undefined = failed.messageId
  void id
}

void accepted
void sent
void assumed
void unchecked
void union
