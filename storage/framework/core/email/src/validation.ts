/**
 * Email validation primitives shared by every driver + the base
 * driver class. Pulled into a module so the `ENVELOPE_ADDRESS` regex
 * lives in exactly one place — the audit (stacksjs/stacks#1871 M-6)
 * called out a copy in `drivers/base.ts` and a copy in `drivers/smtp.ts`,
 * and they were already starting to drift.
 */

/**
 * RFC 5321-ish envelope-address shape. Intentionally tighter than the
 * full RFC because the broader form (display names, comments, source
 * routes) has no business in the envelope slots that hit the wire as
 * raw header values: `to` / `cc` / `bcc` / `from` / `replyTo`.
 *
 * Rejects:
 *   - whitespace, including CR / LF / tab (header-injection vectors)
 *   - angle brackets / quotes / backslashes (header parser confusion)
 *
 * Requires a single `@` separating local part and domain.
 */
export const ENVELOPE_ADDRESS = /^[^\s<>"\\\r\n\t]+@[^\s<>"\\\r\n\t]+$/

/**
 * Throw if `addr` isn't a clean envelope address. The error message
 * includes the role (`to` / `cc` / etc.) so log scrapers can grep for
 * the offending slot without parsing the rest.
 */
export function assertEnvelopeAddress(addr: unknown, role: string): void {
  if (typeof addr !== 'string' || !ENVELOPE_ADDRESS.test(addr)) {
    throw new Error(
      `Email ${role} address is malformed or contains forbidden characters: ${JSON.stringify(addr)}`,
    )
  }
}

/**
 * Reject subject lines containing CR or LF — they become header
 * fields on the wire, and a newline in the value lets an attacker
 * inject additional headers (BCC leak, Reply-To override).
 *
 * Centralized here so the check applies uniformly across drivers
 * (stacksjs/stacks#1871 M-6).
 */
export function assertHeaderSafeSubject(subject: string): void {
  if (/[\r\n]/.test(subject)) {
    throw new Error('Email subject contains forbidden line break characters (CR/LF)')
  }
}

/**
 * Filter a `message.headers` map down to entries whose value is a
 * string and whose name/value contain no CR/LF (header injection
 * vector). Returns undefined when nothing usable remains so caller-
 * sites can spread the result without sending an empty `headers: {}`
 * payload field.
 *
 * Used by every driver that consumes {@link EmailMessage.headers}
 * (stacksjs/stacks#1871 M-5). Centralizing the CR/LF guard ensures
 * the SES `Headers` slot, the SendGrid `headers` field, and the
 * Mailtrap `headers` map all reject the same injection-shaped values.
 */
export function filterStringHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v !== 'string') continue
    // CR / LF in either name or value would let a caller smuggle
    // additional headers. Drop the entry rather than the whole
    // message — most callers want best-effort passthrough.
    if (/[\r\n]/.test(k) || /[\r\n]/.test(v)) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}
