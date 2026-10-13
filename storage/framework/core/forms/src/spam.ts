/**
 * The two spam signals a public form can check without a CAPTCHA.
 *
 * - The honeypot: a field people never see (hidden with CSS, `tabindex=-1`,
 *   `autocomplete=off`). Form-filling bots fill every input, so any value
 *   in it means a bot.
 * - The time on the page: the client reports how many milliseconds passed
 *   between showing the form and sending it. Nobody reads a form and types
 *   their name and email in under a few seconds.
 *
 * Neither proves a human, and neither tracks anyone or loads a third-party
 * script. They stop the common drive-by bots; a rate limit per address or
 * IP is still the caller's job.
 */

export interface SpamSignals {
  /** The hidden honeypot field's value, if the form had one. */
  honeypot?: unknown
  /** Milliseconds the form was open before it was sent, as the client reports it. */
  renderedAtMs?: unknown
}

export interface SpamPolicy {
  /** Check the honeypot. Default true. */
  honeypot?: boolean
  /** The fewest seconds a person could take. 0 turns the check off. Default 3. */
  minSubmitSeconds?: number
}

/**
 * Why a submission looks automated, or null when it does not:
 * `honeypot` (answer as if it worked, and store nothing, so the bot learns
 * nothing) or `too_fast` (ask them to try again).
 */
export function checkSubmissionSpam(signals: SpamSignals, policy: SpamPolicy = {}): 'honeypot' | 'too_fast' | null {
  if ((policy.honeypot ?? true) && typeof signals.honeypot === 'string' && signals.honeypot.trim() !== '')
    return 'honeypot'
  const minSeconds = policy.minSubmitSeconds ?? 3
  const elapsed = typeof signals.renderedAtMs === 'number' ? signals.renderedAtMs : typeof signals.renderedAtMs === 'string' && signals.renderedAtMs.trim() !== '' ? Number(signals.renderedAtMs) : undefined
  if (minSeconds > 0 && elapsed !== undefined && Number.isFinite(elapsed) && elapsed < minSeconds * 1000)
    return 'too_fast'
  return null
}
