import type { EmailMessage, EmailResult } from '@stacksjs/types'
import type { TemplateOptions } from '../template'
import { BaseEmailDriver } from './base'

/**
 * Test-only capture driver (stacksjs/stacks#1871 M-12).
 *
 * Records every `mail.send(...)` payload in memory without opening
 * a network socket or writing to disk. Lighter-weight than the `log`
 * driver (which writes inspection files to `storage/logs/mail/` and
 * does template rendering) — chosen by tests that just need to
 * assert "this flow sent that email" without any I/O side effect.
 *
 * Pick this driver when:
 *   - running fast unit tests that shouldn't touch the filesystem
 *   - asserting on the exact message shape (subject/body/headers)
 *     before any driver-specific transformation
 *   - writing tests that mutate captured state and need
 *     `CaptureEmailDriver.clear()` between cases
 *
 * The `log` driver remains the better fit for local dev (because
 * the disk dump makes inspection easy) and for CI smoke tests that
 * want to surface a render failure visibly. Capture is for unit
 * tests.
 *
 * @example
 * ```ts
 * // bunfig.toml or test setup
 * config.email.default = 'capture'
 *
 * // in tests
 * import { CaptureEmailDriver } from '@stacksjs/email/drivers/capture'
 *
 * beforeEach(() => CaptureEmailDriver.clear())
 *
 * test('signup sends welcome', async () => {
 *   await POST('/api/signup', { email: 'a@b.com' })
 *   const sent = CaptureEmailDriver.all()
 *   expect(sent).toHaveLength(1)
 *   expect(sent[0].subject).toContain('Welcome')
 *   expect(CaptureEmailDriver.last()?.to).toBe('a@b.com')
 * })
 * ```
 */

export interface CapturedMessage extends EmailMessage {
  /** Wall-clock time at the point `send()` was invoked. */
  sentAt: Date
  /**
   * Sequential ID the driver returned to the caller, mirroring the
   * shape real drivers return so test code that asserts on the
   * `EmailResult` doesn't have to special-case capture.
   */
  messageId: string
}

const captured: CapturedMessage[] = []
let nextId = 1

export class CaptureEmailDriver extends BaseEmailDriver {
  public name = 'capture'

  public async send(message: EmailMessage, _options?: TemplateOptions): Promise<EmailResult> {
    try {
      this.validateMessage(message)
      const sentAt = new Date()
      const messageId = `capture-${sentAt.getTime()}-${nextId++}`
      captured.push({ ...message, sentAt, messageId })
      return this.handleSuccess(message, messageId)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  /**
   * All messages captured so far, oldest first. Returns the live
   * array as `readonly` so iteration in test assertions is cheap;
   * call {@link clear} between tests to reset.
   */
  public static all(): readonly CapturedMessage[] {
    return captured
  }

  /**
   * Most-recent captured message, or `undefined` if none have been
   * sent. Equivalent to `CaptureEmailDriver.all().at(-1)`.
   */
  public static last(): CapturedMessage | undefined {
    return captured[captured.length - 1]
  }

  /**
   * Number of captured messages. Equivalent to
   * `CaptureEmailDriver.all().length`; sugar for the common
   * `expect(count).toBe(N)` assertion.
   */
  public static count(): number {
    return captured.length
  }

  /**
   * Clear the captured store. Call in `beforeEach` (or `afterEach`)
   * to keep tests isolated — otherwise a captured message from one
   * test bleeds into the next test's assertions.
   */
  public static clear(): void {
    captured.length = 0
    nextId = 1
  }
}
