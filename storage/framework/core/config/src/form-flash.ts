/**
 * What a form carries back to the page it was posted from: why it was
 * refused (stacksjs/stacks#3309), or what it did (stacksjs/stacks#3312).
 *
 * A browser form that failed an action's `validations` was answered with the
 * 422 body, so the page was replaced by JSON and everything typed was gone.
 * The router now sends the browser back to the page instead, and what the
 * page needs to say what was wrong travels with it: the messages by field,
 * and the values that were posted, so the form can be drawn as it was left.
 *
 * It travels in a cookie because nothing else survives the redirect on every
 * kind of deployment. The API that refuses the form and the server that draws
 * the page are two processes, on serverless two that never share memory, and
 * a refusal has no session to write to. A cookie needs neither.
 *
 * It is signed with the application key, not encrypted. The values in it are
 * the visitor's own, going back to the visitor's own browser, in a cookie no
 * script can read. What the signature keeps out is a cookie written by
 * someone else: a neighbouring subdomain or a plain-http hop could otherwise
 * fill a visitor's form in for them, or put words on the page.
 *
 * Read once. It names the page it is for and is ignored on any other, it
 * stops being read two minutes after it was written, and the page's server
 * removes it with the response that showed it.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const FORM_FLASH_COOKIE = 'stacks_form_flash'

/** How long it is good for. The redirect that reads it follows at once. */
export const FORM_FLASH_SECONDS = 120

/**
 * The most the sealed value may weigh. A browser keeps about 4096 bytes for a
 * cookie with its name and attributes.
 */
export const FORM_FLASH_MAX_BYTES = 3600

/** The longest notice carried. A sentence, not a document. */
export const FORM_FLASH_NOTICE_LENGTH = 500

export interface FormFlash {
  /** The page it is for: the path the form was posted from. */
  path: string
  /** Why the form was refused, by field. */
  errors: Record<string, string[]>
  /** What was posted, by field, less what must not travel. */
  old: Record<string, string | string[]>
  /**
   * What a form that worked did, in the action's own words ("Token
   * revoked"). Absent when the form was refused, or when the action had
   * nothing to say.
   */
  notice?: string
  /** When it stops being read, in milliseconds since the epoch. */
  expires: number
}

/** Words that mark a field whose value is never sent back. */
const SECRET_WORDS = new Set(['password', 'passwords', 'passphrase', 'secret', 'secrets', 'token', 'tokens', 'cvv', 'cvc', 'otp', 'pin', 'ssn', 'credential', 'credentials', 'signature'])
/** The same, for names that take two words to say it. */
const SECRET_PHRASES = ['api key', 'private key', 'card number', 'security code', 'access key']

/**
 * Whether a field's value may be sent back to the form.
 *
 * Never a password, a token or a card's details, however the field is spelled
 * (`current_password`, `apiKey`, `_token`): a refused form must not put a
 * secret into a cookie, and a password field is drawn empty anyway. A field
 * that only sounds like one (`tokens_per_minute`) is left out too: a value
 * typed again costs less than a secret sent back.
 */
export function flashableField(name: string): boolean {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[^a-z\d]+/gi, ' ')
    .trim()
    .toLowerCase()
  if (!words)
    return false
  if (words.split(' ').some(word => SECRET_WORDS.has(word)))
    return false
  return !SECRET_PHRASES.some(phrase => words.includes(phrase))
}

/**
 * What of a posted form can go back to it: text, numbers, yes or no, and
 * lists of those. A file is not sent back (the browser will not refill a file
 * input), nor is anything that is not a plain value.
 */
export function flashableInput(input: Record<string, unknown>): Record<string, string | string[]> {
  const kept: Record<string, string | string[]> = {}
  const plain = (value: unknown): string | null =>
    typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : null

  for (const [name, value] of Object.entries(input)) {
    if (!flashableField(name))
      continue
    if (Array.isArray(value)) {
      const values = value.map(plain)
      if (values.every((entry): entry is string => entry !== null))
        kept[name] = values
      continue
    }
    const one = plain(value)
    if (one !== null)
      kept[name] = one
  }
  return kept
}

function encode(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64url')
}

function signature(body: string, key: string): string {
  return createHmac('sha256', key).update(`stacks-form-flash:${body}`).digest('base64url')
}

function weight(value: string | string[]): number {
  return typeof value === 'string' ? value.length : value.reduce((total, entry) => total + entry.length + 3, 0)
}

/**
 * Seal a refusal for the cookie, or null when there is no application key to
 * sign it with.
 *
 * The messages always fit. What was typed is dropped, longest value first,
 * until the whole thing does: a form that comes back without one long answer
 * still says what was wrong, and a cookie the browser throws away says
 * nothing. Past that the messages themselves are cut to one a field, then to
 * as many fields as fit.
 */
export function sealFormFlash(flash: FormFlash, key: string | undefined | null): string | null {
  if (!key)
    return null

  const errors: Record<string, string[]> = Object.fromEntries(Object.entries(flash.errors).map(([field, messages]) => [field, [...messages]]))
  const old: Record<string, string | string[]> = { ...flash.old }
  const notice = flash.notice ? flash.notice.slice(0, FORM_FLASH_NOTICE_LENGTH) : undefined
  const sealed = (): string => {
    const body = encode(JSON.stringify({ path: flash.path, errors, old, notice, expires: flash.expires }))
    return `${body}.${signature(body, key)}`
  }

  let value = sealed()
  while (value.length > FORM_FLASH_MAX_BYTES && Object.keys(old).length > 0) {
    const longest = Object.keys(old).reduce((a, b) => (weight(old[b]!) > weight(old[a]!) ? b : a))
    delete old[longest]
    value = sealed()
  }
  if (value.length > FORM_FLASH_MAX_BYTES) {
    for (const field of Object.keys(errors))
      errors[field] = errors[field]!.slice(0, 1).map(message => message.slice(0, 200))
    value = sealed()
  }
  while (value.length > FORM_FLASH_MAX_BYTES && Object.keys(errors).length > 1) {
    delete errors[Object.keys(errors).pop()!]
    value = sealed()
  }
  return value
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

/** The same path, whether or not it was written with a trailing slash. */
function samePage(a: string, b: string): boolean {
  const trim = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path) || '/'
  return trim(a) === trim(b)
}

/**
 * Read a sealed refusal back, for the page at `path`.
 *
 * Null for anything that is not exactly what this application sealed for
 * this page and still in date: no cookie, no key, a signature that does not
 * match, another page's, one past its time, or a body that is not the shape
 * it should be. A page then draws as if nothing had been refused.
 */
export function openFormFlash(value: string | undefined | null, key: string | undefined | null, path: string, now: number = Date.now()): FormFlash | null {
  if (!value || !key)
    return null
  const mark = value.lastIndexOf('.')
  if (mark <= 0)
    return null
  const body = value.slice(0, mark)
  const given = Buffer.from(value.slice(mark + 1), 'utf8')
  const expected = Buffer.from(signature(body, key), 'utf8')
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  }
  catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object')
    return null
  const flash = parsed as Partial<FormFlash>
  if (typeof flash.path !== 'string' || typeof flash.expires !== 'number' || !flash.errors || typeof flash.errors !== 'object' || !flash.old || typeof flash.old !== 'object')
    return null
  if (flash.expires <= now || !samePage(flash.path, path))
    return null
  if (!Object.values(flash.errors).every(stringList))
    return null
  if (!Object.values(flash.old).every(entry => typeof entry === 'string' || stringList(entry)))
    return null
  if (flash.notice !== undefined && typeof flash.notice !== 'string')
    return null
  const opened: FormFlash = { path: flash.path, errors: flash.errors, old: flash.old as FormFlash['old'], expires: flash.expires }
  if (flash.notice)
    opened.notice = flash.notice
  return opened
}

/** The `Set-Cookie` that carries a sealed refusal or notice to the page. */
export function formFlashCookie(value: string, secure: boolean): string {
  return `${FORM_FLASH_COOKIE}=${value}; Path=/; Max-Age=${FORM_FLASH_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

/** The `Set-Cookie` that removes it, once a page has shown it. */
export function expiredFormFlashCookie(secure: boolean): string {
  return `${FORM_FLASH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`
}

/**
 * Remove the cookie with the response of the page that showed it.
 *
 * For the page the cookie names, asked for with a GET and answered with HTML.
 * Anything else leaves it alone: a script or an image fetched on the way has
 * shown it to no one, and nor has another page, whose request may land
 * between the refusal and the redirect that follows it. Returns the response
 * to send, the same one when there was nothing to do.
 */
export function clearShownFormFlash(request: Request, response: Response, key: string | undefined | null): Response {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD')
    return response
  const cookie = request.headers.get('cookie') ?? ''
  const at = cookie.indexOf(`${FORM_FLASH_COOKIE}=`)
  if (at === -1)
    return response
  if (!(response.headers.get('content-type') ?? '').includes('text/html'))
    return response

  const rest = cookie.slice(at + FORM_FLASH_COOKIE.length + 1)
  const end = rest.indexOf(';')
  let path: string
  try {
    path = new URL(request.url).pathname
  }
  catch {
    return response
  }
  if (!openFormFlash((end === -1 ? rest : rest.slice(0, end)).trim(), key, path))
    return response

  const secure = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https:')
  const expired = expiredFormFlashCookie(secure)
  try {
    response.headers.append('set-cookie', expired)
    return response
  }
  catch {
    // A response whose headers cannot be changed is sent again with them.
    const headers = new Headers(response.headers)
    headers.append('set-cookie', expired)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}
