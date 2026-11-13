/**
 * The short code a person reads off their terminal and types into the approve
 * page before a connect is approved.
 *
 * Why it exists: an approve link is a URL with a connect code in it, and
 * anyone can mint one (`POST /api/cli/connect`) for any app name. Approving
 * hands that app's keys, or its licence, to whoever holds the code. A
 * signed-in person talked into opening somebody else's link and pressing the
 * one button on it would give those away. The confirmation code ties the page
 * to a terminal: the service answers it only to the caller that asked for the
 * connect code, and refuses to approve until the person has entered what
 * their own terminal shows. A link that arrives by chat or email comes with
 * no terminal.
 *
 * It is derived from the connect code, so it needs no column and cannot drift
 * from the code it belongs to. It is six characters of a SHA-256 under a
 * prefix of its own, so it is neither the hash a store keeps nor a piece of
 * the connect code.
 *
 * A service sends it as `confirmCode` beside `code` and `approveUrl`, which
 * `buddy hq:connect` prints. The approve page asks for it and never renders
 * it: a code the page shows is a code a person can agree with without looking
 * at anything.
 */

// No 0/O and no 1/I/L: the code is read off one screen and typed into another.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 6

const encoder = new TextEncoder()

/** The confirmation code of a connect code, as `ABC-DEF`. */
export async function confirmationCode(connectCode: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`hq-connect-confirm:${connectCode}`)))
  let text = ''
  for (let i = 0; i < LENGTH; i++)
    text += ALPHABET[digest[i]! % ALPHABET.length]
  return `${text.slice(0, 3)}-${text.slice(3)}`
}

/** What a person typed, reduced to what is compared: case, spaces and the dash do not matter. */
function normalized(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
}

/**
 * Whether what a person typed is the confirmation code of this connect code.
 * Compared in constant time. Limit the attempts per person in the router: six
 * characters are only as strong as the number of guesses allowed.
 */
export async function confirmationMatches(connectCode: string, typed: unknown): Promise<boolean> {
  const expected = normalized(await confirmationCode(connectCode))
  const given = normalized(typed)
  if (given.length !== expected.length)
    return false
  let diff = 0
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}
