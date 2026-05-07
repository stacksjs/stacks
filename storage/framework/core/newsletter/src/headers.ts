/**
 * RFC 8058 / RFC 2369 List-Unsubscribe header construction.
 *
 * Why both mailto: and https://?  Some clients (older Outlook, some
 * webmails) only honor `mailto:`; modern clients prefer the one-click
 * HTTPS form. Including both lets every client unsubscribe without
 * forcing the user to look for a tiny in-body link.
 *
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click` is what tells
 * Gmail/Yahoo/etc. that POSTing to the https URL with no body is a
 * valid one-click unsubscribe. Without that header those mailbox
 * providers fall back to *clicking* the URL — which means a normal
 * GET handler. RFC 8058 clients will POST.
 */

export interface UnsubscribeHeaderOptions {
  /** Absolute URL the recipient hits to unsubscribe — must accept POST for one-click. */
  url: string
  /**
   * Optional unsubscribe mailbox. Many bulk senders run an automated
   * mailbox that strips the address and unsubscribes them. If you
   * don't have one, omit and the header carries only the URL.
   */
  mailto?: string
}

/**
 * Build the headers for an outbound campaign email.
 *
 * Returns a flat header map that drivers can copy into the outgoing
 * MIME envelope.
 */
export function buildUnsubscribeHeaders(opts: UnsubscribeHeaderOptions): Record<string, string> {
  if (!opts.url || !/^https?:\/\//i.test(opts.url))
    throw new Error('[newsletter] List-Unsubscribe URL must be absolute (http/https)')

  const parts: string[] = []
  if (opts.mailto)
    parts.push(`<mailto:${opts.mailto}>`)
  parts.push(`<${opts.url}>`)

  return {
    'List-Unsubscribe': parts.join(', '),
    // RFC 8058 one-click marker. Drivers that don't yet propagate
    // arbitrary headers can ignore it; clients that do POST will
    // hit the URL with `List-Unsubscribe=One-Click` in the body.
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
