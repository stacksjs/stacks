/**
 * What `query_logs.bindings` keeps of the values a query bound.
 *
 * `GET /api/queries/:id` returns the whole row and the table outlives the
 * request by the retention window, so it must not become a second copy of every
 * session id, reset token and password hash the application touches. Until
 * bun-query-builder 0.2.70 only SQLite delivered bindings at all. Every
 * dialect does now, which made this the common case rather than an edge.
 *
 * A value is stored as `<redacted>` when any of these holds:
 *   - the SQL binds it to a column with a sensitive name (`password`,
 *     `remember_token`, `api_key`, `two_factor_secret`, ...);
 *   - it is text and the statement targets a table with a sensitive name
 *     (`sessions`, `password_resets`, `oauth_access_tokens`, ...), where even
 *     the `id` is a credential;
 *   - it is text, its column cannot be worked out, and the statement names
 *     something sensitive anywhere;
 *   - it is an object, or text holding JSON, with a key that has a sensitive
 *     name at any depth (`{"api_key": ...}` bound to a `settings` column);
 *   - it looks like a credential on its own: a password hash, a JWT, a run of
 *     32 or more hex digits, a long mixed-case random token, or a key with a
 *     well-known prefix.
 *
 * Without `captureValues` nothing but each value's type is kept, so the count
 * and shape of the bindings survive without the data. Binary values are only
 * ever recorded by type.
 *
 * The error text of a failed query can copy a bound value too, so the values
 * the bindings withhold are taken out of `query_logs.error` where the driver
 * printed them, as far as {@link queryLogError} can recognise them, and it
 * keeps at most the first MAX_QUERY_LOG_ERROR_LENGTH characters of the
 * message.
 */

export const REDACTED_BINDING = '<redacted>'

/** Whole words that make a table or column name sensitive. */
const SENSITIVE_WORDS: ReadonlySet<string> = new Set([
  'apikey',
  'authorization',
  'bearer',
  'challenge',
  'challenges',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'cvc',
  'cvv',
  'hash',
  'hotp',
  'jwt',
  'nonce',
  'otp',
  'passphrase',
  'passwd',
  'password',
  'passwords',
  'pin',
  'pwd',
  'salt',
  'secret',
  'secrets',
  'session',
  'sessions',
  'ssn',
  'token',
  'tokens',
  'totp',
  'verification',
  'verifications',
])

/** Adjacent word pairs that are sensitive where neither word is alone. */
const SENSITIVE_PAIRS: ReadonlySet<string> = new Set([
  'access key',
  'api key',
  'app key',
  'auth code',
  'auth codes',
  'backup code',
  'backup codes',
  'card number',
  'credit card',
  'encryption key',
  'license key',
  'license keys',
  'private key',
  'recovery code',
  'recovery codes',
  'secret key',
  'security code',
  'signing key',
  'two factor',
])

/**
 * Whether a table or column name marks its values as secret. Names are split
 * into words (`remember_token`, `rememberToken` and `REMEMBER-TOKEN` all read
 * as `remember token`) so `pin` matches a `pin` column and not `shipping`.
 */
export function isSensitiveName(name: string): boolean {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean)
  return words.some((word, index) => SENSITIVE_WORDS.has(word) || SENSITIVE_PAIRS.has(`${word} ${words[index + 1]}`))
}

/**
 * Credential shapes, matched anywhere in a value so a token inside a URL or a
 * JSON payload is caught too. Tuned for values rather than for the stack
 * traces `sanitizeStackTrace` handles: a long lowercase slug is not a secret,
 * so an opaque run only counts when it mixes cases and digits (see below).
 *
 * Every value a query binds is judged wherever values are kept, and a caller
 * chooses much of what is bound, so judging a value must stay linear in its
 * length. A pattern is tried from every position of the value, and a match
 * ends the search, so each one here fails within a bounded number of
 * characters of any start, or at a character no other start reads past:
 *   - the modular crypt prefix's only open run, `pbkdf2[\w-]*`, stops at the
 *     first character outside `[\w-]`, and every start is a `$`, which is
 *     outside it, so no two starts read the same run;
 *   - the hex, Stripe and AWS shapes fail within 32, 24 and 21 characters of
 *     their start.
 * A JWT is not one of them: see {@link hasJwt}.
 */
const CREDENTIAL_PATTERNS: ReadonlyArray<RegExp> = [
  /\$(?:2[abxy]?|argon2(?:id|i|d)|scrypt|pbkdf2[\w-]*|[156y])\$/, // modular crypt hashes: bcrypt, argon2, scrypt, sha-crypt
  /[\da-f]{32,}/i, // hex, also inside a key: digests, session ids, reset tokens
  /\b(?:sk|pk|rk)_(?:live|test)_\w{16,}/, // Stripe-shaped
  /\bAKIA[\dA-Z]{16}\b/, // AWS access key id
]

/**
 * A run of base64url characters and dots long enough to hold the shortest
 * JWT {@link hasJwt} recognises: `eyJ`, 8 characters, a dot, 8, and a dot.
 */
const JWT_RUN = /[\w.-]{21,}/g

/** A JWT's header segment: `eyJ` where a word starts, and 8 more characters. */
const JWT_HEADER = /(?:^|-)eyJ[\w-]{8}/

/**
 * Whether `text` holds a JWT, as `\beyJ[\w-]{8,}\.[\w-]{8,}\.` would match:
 * `eyJ` where a word starts, 8 or more base64url characters, a dot, 8 or
 * more, and a dot. That pattern, tried from every `-eyJ` of a run without
 * dots, reads the rest of the run each time, which is quadratic: 128,000
 * characters of `-eyJ` took a second. The characters between `eyJ` and the
 * next dot all belong to its segment, so the same test reads each run of
 * `[\w.-]` once, split at its dots: a segment holding the header, the next
 * one 8 characters or longer, and a dot after that.
 */
function hasJwt(text: string): boolean {
  for (const [run] of text.matchAll(JWT_RUN)) {
    const segments = run.split('.')
    for (let at = 0; at + 2 < segments.length; at++) {
      if (segments[at + 1]!.length >= 8 && JWT_HEADER.test(segments[at]!))
        return true
    }
  }
  return false
}

/**
 * A run long enough to be a random token rather than a word or a slug. Each
 * match is as long as it can be and the search goes on after it, so a start
 * that does not match reads fewer than 32 characters.
 */
const OPAQUE_RUN = /[\w-]{32,}/g

/**
 * Whether a value looks like a credential by itself, read in time linear in
 * its length whatever it holds (see {@link CREDENTIAL_PATTERNS}).
 */
export function looksLikeCredential(text: string): boolean {
  if (CREDENTIAL_PATTERNS.some(pattern => pattern.test(text)) || hasJwt(text))
    return true
  for (const [run] of text.matchAll(OPAQUE_RUN)) {
    if (/[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run))
      return true
  }
  return false
}

/** A quote followed by a colon: where a key ends, in JSON text. */
const KEY_END = /"\s*:/g

/** How far back a key's opening quote is looked for. Longer keys are not read. */
const MAX_KEY_LENGTH = 128

/** Deeper encodings are all read as this deep. */
const MAX_ESCAPES = 16

/**
 * How many backslashes stand before the quote at `at`. A key of JSON encoded
 * inside a JSON string is quoted `\"`, one encoded again `\\\"`, and so on,
 * so both quotes of a key have the same count.
 */
function escapesBefore(text: string, at: number): number {
  let count = 0
  while (count < MAX_ESCAPES && text[at - count - 1] === '\\')
    count++
  return count
}

/**
 * Whether JSON text has a key with a sensitive name at any depth. A secret
 * in a JSON document is judged by its key, the way a column's value is judged
 * by the column: `{"api_key": "k1"}` bound to `settings` has neither a
 * sensitive column nor a credential's shape.
 *
 * Keys are read from the text rather than from a parse, so a truncated
 * document, one inside a longer string, and one encoded inside a JSON string
 * (`{"payload":"{\"token\":...}"}`) are read too. Each key is found by walking
 * back from its closing quote to the opening quote with the same escaping, at
 * most MAX_KEY_LENGTH characters, so the scan stays linear in the length of
 * the value. A pattern matching whole quoted strings instead spent 2.2s on a
 * 148 KB JSON string of JSON, and found none of its keys.
 */
function hasSensitiveKey(text: string): boolean {
  for (const { index: end } of text.matchAll(KEY_END)) {
    const escapes = escapesBefore(text, end)
    const floor = Math.max(0, end - escapes - MAX_KEY_LENGTH)
    for (let start = end - escapes - 1; start >= floor; start--) {
      if (text[start] !== '"' || escapesBefore(text, start) !== escapes)
        continue
      if (isSensitiveName(text.slice(start + 1, end - escapes)))
        return true
      break
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Which column each placeholder meets
// ---------------------------------------------------------------------------

interface SqlToken {
  /**
   * `word` is a bare word (keyword or identifier), `name` a quoted
   * identifier, `param` a placeholder, `value` a literal.
   */
  kind: 'word' | 'name' | 'param' | 'value' | 'op' | '(' | ')' | ','
  /** As written, so `rememberToken` still splits into words; for a qualified name, its last part. */
  text: string
  /** Zero-based position in the parameter array, for placeholders. */
  param?: number
}

/**
 * Keywords that sit next to a placeholder or its column. Everything else a
 * bare word can be is treated as a name, which is why common column names
 * such as `key`, `status` or `type` are deliberately absent.
 */
const KEYWORDS: ReadonlySet<string> = new Set([
  'all', 'and', 'any', 'as', 'between', 'by', 'case', 'collate', 'conflict', 'delete', 'distinct', 'do',
  'duplicate', 'else', 'end', 'escape', 'exists', 'false', 'from', 'glob', 'having', 'ignore', 'ilike', 'in',
  'insert', 'into', 'is', 'join', 'like', 'limit', 'match', 'not', 'null', 'offset', 'on', 'only', 'or',
  'regexp', 'replace', 'returning', 'rlike', 'select', 'set', 'some', 'table', 'then', 'true', 'update',
  'using', 'values', 'when', 'where', 'with',
])

const COMPARISONS: ReadonlySet<string> = new Set([
  '=', '==', '!=', '<>', '<', '>', '<=', '>=', 'glob', 'ilike', 'is', 'like', 'match', 'regexp', 'rlike',
])

const TABLE_KEYWORDS: ReadonlySet<string> = new Set(['from', 'into', 'join', 'table', 'update'])

/** A bare word, lowercased, for comparing with keywords. */
function keyword(token: SqlToken | undefined): string | undefined {
  return token?.kind === 'word' ? token.text.toLowerCase() : undefined
}

function isName(token: SqlToken | undefined): token is SqlToken {
  return token?.kind === 'name' || (token?.kind === 'word' && !KEYWORDS.has(keyword(token)!))
}

function isWord(token: SqlToken | undefined, ...words: string[]): boolean {
  const word = keyword(token)
  return word !== undefined && words.includes(word)
}

/** An operator or keyword that compares or assigns: `=`, `<>`, `LIKE`, `IS`, ... */
function isComparison(token: SqlToken | undefined): boolean {
  return (token?.kind === 'op' && COMPARISONS.has(token.text)) || COMPARISONS.has(keyword(token) ?? '')
}

interface ScannedSql {
  tokens: SqlToken[]
  /** False when a literal, quoted name or comment ran off the end. */
  complete: boolean
}

function scanSql(sql: string): ScannedSql {
  const tokens: SqlToken[] = []
  let complete = true
  let positional = 0
  let at = 0

  const push = (token: SqlToken): void => {
    // `"users"."password"` and `excluded.token` are the column they end in.
    const dot = tokens.at(-1)
    if ((token.kind === 'name' || token.kind === 'word') && dot?.kind === 'op' && dot.text === '.' && isName(tokens.at(-2))) {
      tokens.splice(-2, 2)
      token = { kind: 'name', text: token.text }
    }
    tokens.push(token)
  }

  // The text up to `quote`, where a doubled quote stands for itself.
  const quoted = (quote: string, backslashEscapes: boolean): string => {
    let text = ''
    for (at++; at < sql.length; at++) {
      const char = sql[at]!
      if (backslashEscapes && char === '\\') {
        text += sql[++at] ?? ''
        continue
      }
      if (char === quote) {
        if (sql[at + 1] !== quote) {
          at++
          return text
        }
        at++
      }
      text += char
    }
    complete = false
    return text
  }

  const sticky = (pattern: RegExp): RegExpExecArray | null => {
    pattern.lastIndex = at
    const match = pattern.exec(sql)
    if (match)
      at += match[0].length
    return match
  }

  while (at < sql.length) {
    const char = sql[at]!
    if (/\s/.test(char)) {
      at++
    }
    else if (sql.startsWith('--', at)) {
      const end = sql.indexOf('\n', at)
      at = end < 0 ? sql.length : end
    }
    else if (sql.startsWith('/*', at)) {
      const end = sql.indexOf('*/', at + 2)
      if (end < 0)
        complete = false
      at = end < 0 ? sql.length : end + 2
    }
    else if (char === '\'') {
      push({ kind: 'value', text: quoted('\'', true) })
    }
    else if (char === '"' || char === '`') {
      push({ kind: 'name', text: quoted(char, false) })
    }
    else if (char === '$') {
      const numbered = sticky(/\$(\d+)/y)
      if (numbered) {
        push({ kind: 'param', text: numbered[0], param: Number(numbered[1]) - 1 })
        continue
      }
      // PostgreSQL dollar quoting: $$...$$ or $tag$...$tag$.
      const dollar = sticky(/\$([A-Z_a-z]\w*)?\$/y)
      if (!dollar) {
        push({ kind: 'op', text: char })
        at++
        continue
      }
      const end = sql.indexOf(dollar[0], at)
      if (end < 0)
        complete = false
      at = end < 0 ? sql.length : end + dollar[0].length
      push({ kind: 'value', text: '' })
    }
    else if (char === '?') {
      const numbered = sticky(/\?(\d+)/y)
      if (numbered) {
        push({ kind: 'param', text: numbered[0], param: Number(numbered[1]) - 1 })
      }
      else {
        at++
        push({ kind: 'param', text: '?', param: positional++ })
      }
    }
    else if (/\d/.test(char)) {
      sticky(/\d+(?:\.\d+)?(?:e[+-]?\d+)?/iy)
      push({ kind: 'value', text: '' })
    }
    else if (/[A-Z_a-z]/.test(char)) {
      push({ kind: 'word', text: sticky(/[A-Z_a-z][\w$]*/y)![0] })
    }
    else if (char === '(' || char === ')' || char === ',') {
      at++
      push({ kind: char, text: char })
    }
    else {
      push({ kind: 'op', text: sticky(/<=|>=|<>|!=|==|\|\||::|->>|->|[^\s\w]/y)![0] })
    }
  }

  // PostgreSQL numbers its placeholders, and there `?` is a JSON operator.
  if (tokens.some(token => token.kind === 'param' && token.text.startsWith('$'))) {
    for (const token of tokens) {
      if (token.kind === 'param' && token.text.startsWith('?')) {
        token.kind = 'op'
        delete token.param
      }
    }
  }

  return { tokens, complete }
}

/** A scanned statement, with its parentheses paired up front. */
interface Statement {
  tokens: SqlToken[]
  /**
   * For a `)`, the `(` it closes. For any other token, the `(` of the group
   * it sits in, or -1 at the top level. Computed once, so a placeholder in a
   * list of thousands does not walk back over the ones before it.
   */
  openers: number[]
}

function pairParentheses(tokens: SqlToken[]): number[] {
  const openers: number[] = []
  const open: number[] = []
  for (const [index, token] of tokens.entries()) {
    openers.push((token.kind === ')' ? open.pop() : open.at(-1)) ?? -1)
    if (token.kind === '(')
      open.push(index)
  }
  return openers
}

/** Skip back over a `NOT`, as in `NOT IN`, `NOT LIKE`, `IS NOT`. */
function skipNot(tokens: SqlToken[], at: number): number {
  return isWord(tokens[at], 'not') ? at - 1 : at
}

/**
 * The column an operand ending at `at` names: `token`, `"sessions"."id"`, or
 * the first name inside a call such as `lower(email)`.
 */
function operandColumn({ tokens, openers }: Statement, at: number): string | undefined {
  const token = tokens[at]
  if (token?.kind !== ')')
    return isName(token) ? token.text : undefined
  return tokens.slice(openers[at]! + 1, at).find(inner => isName(inner))?.text
}

/**
 * The column a value starting at `start` is compared with or assigned to:
 * `col = ?`, `col NOT LIKE ?`, `col IN (?, ?)`, `col BETWEEN ? AND ?`,
 * `col = lower(?)`, `SET col = ?` and `? = col`.
 */
function valueColumn(statement: Statement, start: number, end: number): string | undefined {
  const { tokens, openers } = statement
  // `IS NOT ?` puts its NOT between the operator and the value.
  const operator = isWord(tokens[start - 1], 'not') && isWord(tokens[start - 2], 'is') ? start - 2 : start - 1
  const before = tokens[operator]
  if (isComparison(before))
    return operandColumn(statement, skipNot(tokens, operator - 1))

  if (isWord(before, 'between'))
    return operandColumn(statement, skipNot(tokens, start - 2))

  if (isWord(before, 'and') && isWord(tokens[start - 3], 'between'))
    return operandColumn(statement, skipNot(tokens, start - 4))

  if (before?.kind === '(' || before?.kind === ',') {
    const open = openers[start]!
    if (open > 0 && isWord(tokens[open - 1], 'in'))
      return operandColumn(statement, skipNot(tokens, open - 2))
    // An argument of a call is judged as the call: `col = lower(?)`,
    // `col = ANY($1)`.
    if (open > 0 && (isName(tokens[open - 1]) || isWord(tokens[open - 1], 'any', 'all', 'some')))
      return valueColumn(statement, open - 1, open - 1)
  }

  // `? = col`. A call on that side is left unresolved rather than read as
  // a column named after the function.
  const after = tokens[end + 1]
  const operand = tokens[end + 2]
  if (after?.kind === 'op' && isComparison(after) && isName(operand) && tokens[end + 3]?.kind !== '(')
    return operand.text

  return undefined
}

/**
 * `INSERT INTO t (a, b) VALUES (?, ?), (?, ?)`: each placeholder takes the
 * column at its position in the tuple, including when a call wraps it.
 */
function insertColumns(tokens: SqlToken[]): Map<number, string | undefined> {
  const columns = new Map<number, string | undefined>()
  const insert = tokens.findIndex(token => isWord(token, 'insert', 'replace'))
  const into = tokens.findIndex((token, index) => index > insert && isWord(token, 'into'))
  if (insert < 0 || into < 0 || tokens[into + 2]?.kind !== '(')
    return columns

  const names: Array<string | undefined> = []
  let index = into + 3
  let expectName = true
  for (; index < tokens.length && tokens[index]!.kind !== ')'; index++) {
    const token = tokens[index]!
    if (token.kind === ',')
      expectName = true
    else if (expectName) {
      names.push(isName(token) ? token.text : undefined)
      expectName = false
    }
  }

  if (!isWord(tokens[index + 1], 'values', 'value'))
    return columns

  let depth = 0
  let item = 0
  for (index += 2; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token.kind === '(') {
      if (depth++ === 0)
        item = 0
    }
    else if (token.kind === ')') {
      depth--
    }
    else if (token.kind === ',' && depth === 1) {
      item++
    }
    else if (token.kind === 'param' && depth > 0) {
      columns.set(index, names[item])
    }
    else if (depth === 0 && token.kind === 'word') {
      break
    }
  }
  return columns
}

interface BindingContext {
  /** Every column each parameter position meets (PostgreSQL may reuse `$1`). */
  columns: Map<number, Array<string | undefined>>
  /** The statement reads or writes a table with a sensitive name. */
  sensitiveTable: boolean
  /** A sensitive name appears anywhere in the statement. */
  sensitiveMention: boolean
}

function bindingContext(sql: string): BindingContext {
  const { tokens, complete } = scanSql(sql)
  const columns = new Map<number, Array<string | undefined>>()
  // A statement the scanner could not finish is judged by its words alone.
  if (!complete) {
    const words = sql.match(/[A-Z_a-z][\w$]*/g) ?? []
    const sensitive = words.some(word => isSensitiveName(word))
    return { columns, sensitiveTable: sensitive, sensitiveMention: sensitive }
  }

  const statement = { tokens, openers: pairParentheses(tokens) }
  const inserted = insertColumns(tokens)
  for (const [index, token] of tokens.entries()) {
    if (token.kind !== 'param' || token.param === undefined)
      continue
    const column = inserted.get(index) ?? valueColumn(statement, index, index)
    const seen = columns.get(token.param) ?? []
    seen.push(column)
    columns.set(token.param, seen)
  }

  const sensitiveTable = tokens.some((token, index) =>
    isName(token)
    && TABLE_KEYWORDS.has(keyword(tokens[index - 1]) ?? '')
    // `ON DUPLICATE KEY UPDATE col = ?` names a column, not a table.
    && !isWord(tokens[index - 2], 'key')
    && isSensitiveName(token.text))
  const sensitiveMention = tokens.some(token => isName(token) && isSensitiveName(token.text))

  return { columns, sensitiveTable, sensitiveMention }
}

// ---------------------------------------------------------------------------
// The persisted form
// ---------------------------------------------------------------------------

function isBytes(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}

/** `<string>`, `<number>`, `<date>`, `<bytes>`, ... */
function typeTag(value: unknown): string {
  if (value instanceof Date)
    return '<date>'
  if (isBytes(value))
    return '<bytes>'
  return `<${typeof value}>`
}

/** An object or array, as opposed to text, a number, bytes or a date. */
function isStructured(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !(value instanceof Date) && !isBytes(value)
}

/** What {@link jsonText} returns for a value whose JSON text is longer than its limit. */
const TOO_LONG: unique symbol = Symbol('longer than the limit')

/**
 * JSON text of a structured value, or undefined when it has none. With a
 * `limit`, TOO_LONG for a value whose text is longer than that, found out
 * without writing much more of it: the replacer counts what each key and
 * value adds to the text, less quotes' escapes and commas, and stops the
 * writing once that passes the limit.
 */
function jsonText(value: unknown): string | undefined
function jsonText(value: unknown, limit: number): string | undefined | typeof TOO_LONG
function jsonText(value: unknown, limit = Number.POSITIVE_INFINITY): string | undefined | typeof TOO_LONG {
  let written = 0
  let root = true
  function count(this: unknown, key: string, item: unknown): unknown {
    // The root and an array's items are written without a key.
    const member = !root && !Array.isArray(this)
    root = false
    // A value JSON leaves out writes nothing in an object and `null` in an array.
    const omitted = item === undefined || typeof item === 'function' || typeof item === 'symbol'
    if (member && omitted)
      return item
    written += (member ? key.length + 3 : 0) + (omitted
      ? 4
      : typeof item === 'string' ? item.length + 2 : typeof item === 'object' && item !== null ? 2 : String(item).length)
    if (written > limit)
      throw TOO_LONG
    return item
  }
  try {
    return JSON.stringify(value, limit === Number.POSITIVE_INFINITY ? undefined : count)
  }
  catch (error) {
    return error === TOO_LONG ? TOO_LONG : undefined
  }
}

export interface QueryLogBindingOptions {
  /**
   * Keep the values that are not sensitive. When false only each value's
   * type is kept.
   */
  captureValues: boolean
}

/** How the other Stacks switches read on and off (`isVitessSharded`, `buddy migrate`'s guards). */
const SWITCH_ON: ReadonlySet<string> = new Set(['1', 'true', 'yes', 'on'])
const SWITCH_OFF: ReadonlySet<string> = new Set(['0', 'false', 'no', 'off'])

/**
 * `captureBindings` as config or `DB_QUERY_LOGGING_CAPTURE_BINDINGS` gave it:
 * `undefined` when it is not set, `null` when it is set to something that is
 * not a switch, else the boolean it spells. The env proxy turns only `true`
 * and `false` into booleans, so `0`, `off` or ` Yes ` arrive here as text.
 */
export function parseCaptureBindings(setting: unknown): boolean | null | undefined {
  if (typeof setting === 'boolean')
    return setting
  if (setting === undefined || setting === null)
    return undefined
  const text = String(setting).trim().toLowerCase()
  if (text === '')
    return undefined
  if (SWITCH_ON.has(text))
    return true
  if (SWITCH_OFF.has(text))
    return false
  return null
}

/**
 * `value`, the parameter at `index`, as the bindings keep it where values are
 * kept: the value itself, `<redacted>`, or a type tag such as `<bytes>`.
 */
function keptValue(context: BindingContext, value: unknown, index: number): unknown {
  if (value === null || value === undefined)
    return null

  const columns = context.columns.get(index) ?? []
  if (columns.some(column => column !== undefined && isSensitiveName(column)))
    return REDACTED_BINDING
  if (isBytes(value))
    return typeTag(value)

  if (typeof value === 'string' || (typeof value === 'object' && !(value instanceof Date))) {
    const unresolved = columns.every(column => column === undefined)
    if (context.sensitiveTable || (unresolved && context.sensitiveMention))
      return REDACTED_BINDING
    const text = typeof value === 'string' ? value : jsonText(value)
    if (text === undefined)
      return typeTag(value)
    if (looksLikeCredential(text) || hasSensitiveKey(text))
      return REDACTED_BINDING
  }

  return typeof value === 'bigint' ? String(value) : value
}

/**
 * The bindings of `sql` as they may be persisted: one entry per parameter,
 * each the value itself, `<redacted>`, or a type tag such as `<string>`.
 */
export function queryLogBindings(sql: string, parameters: readonly unknown[], options: QueryLogBindingOptions): unknown[] {
  if (parameters.length === 0)
    return []
  if (!options.captureValues)
    return parameters.map(value => value === null || value === undefined ? null : typeTag(value))

  const context = bindingContext(sql)
  return parameters.map((value, index) => keptValue(context, value, index))
}

// ---------------------------------------------------------------------------
// The error text of a failed query
// ---------------------------------------------------------------------------

/**
 * The most characters of a failed query's error that `query_logs.error`
 * keeps. PostgreSQL prints a value it cannot parse in full (a 20,000
 * character value gave a 20,056 character message on PostgreSQL 16), so
 * without a limit the column holds as much as a caller binds. The rest of a
 * longer error is dropped and counted, as `<truncated: 15960 more
 * characters>`, and the limit is also what bounds the cost of taking values
 * out of it (see {@link scanForValues}).
 */
export const MAX_QUERY_LOG_ERROR_LENGTH = 4096

/**
 * How many characters of the start of a value a copy shorter than the value
 * must hold to be recognised. MySQL cuts the key of a duplicate entry at 64
 * bytes, which is 16 characters or more, and a rejected value at 128
 * characters, so a value that starts the key it is printed in, or is printed
 * alone, leaves at least this much. A later column of a key over several
 * columns starts wherever the ones before it end, and a prefix index
 * (`UNIQUE (token(10))`) prints only what it indexes, so MySQL can print
 * fewer characters of a value than this; such a copy is not recognised.
 */
const CUT_VALUE_LENGTH = 16

/**
 * The shortest copy that is looked for of a value withheld without being
 * secret, as every value is in production, where the bindings keep types. A
 * shorter one is left in place: taking out every copy of a bound `key` or
 * `email` would take the `key` out of "for key" and the `email` out of
 * `users.email` as well. A secret is looked for whatever its length.
 */
const MIN_TYPED_COPY_LENGTH = 8

/** A letter, digit or underscore: a value next to one is part of a longer word. */
const WORD_CHAR = /[\p{L}\p{N}_]/u

/**
 * The most characters of a value that are read to judge whether it is
 * secret where only types are kept (see {@link secretValues}). Longer text
 * is taken to be secret without being read, and so is a structured value
 * once its keys and values come to more than this in its JSON text. That
 * count leaves out commas and escapes, so the JSON text of a value judged
 * can be longer: 80,012 characters for 40,001 one-digit numbers.
 */
const MAX_JUDGED_LENGTH = 65_536

/**
 * How far {@link printedValue} reads the values of one failed query: arrays
 * nested at most this deep (PostgreSQL takes 6 dimensions), and, across all
 * of the query's values together, at most this many items and this many
 * characters of the ways they can be printed. JSON.parse nests arrays
 * 100,000 deep, one array can hold another many times over, and a query can
 * bind any number of values, so past any of these the values are not looked
 * for and the error keeps none of its text (see {@link queryLogError}).
 */
const MAX_PRINTED_DEPTH = 32
const MAX_PRINTED_ITEMS = 100_000
const MAX_PRINTED_CHARACTERS = 16_777_216

/** What one error has left of MAX_PRINTED_ITEMS and MAX_PRINTED_CHARACTERS. */
interface PrintBudget {
  items: number
  characters: number
}

const utf8 = new TextEncoder()

function bytesOf(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

/**
 * Bytes as MySQL prints a rejected value ("Incorrect integer value: '...'")
 * or a binary key: printable ASCII as it is, every other byte as `\xHH`. It
 * stops one character past `limit`, since a byte can take four characters
 * and nothing past the limit can be in the error.
 */
function mysqlPrintable(bytes: Uint8Array, limit: number): string {
  let text = ''
  for (let at = 0; at < bytes.length && text.length <= limit; at++) {
    const byte = bytes[at]!
    text += byte >= 0x20 && byte < 0x7F ? String.fromCharCode(byte) : `\\x${byte.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return text
}

/** One way a withheld value can appear in an error message. */
interface PrintedValue {
  text: string
  /** False when `text` is only the start of the value. */
  whole: boolean
  /** A number, which is looked for only where its value is secret. */
  number?: boolean
}

/** At most `limit` characters of `text`, and whether that is all of it. */
function upTo(text: string, whole: boolean, limit: number): PrintedValue {
  return text.length <= limit ? { text, whole } : { text: text.slice(0, limit), whole: false }
}

/**
 * The most characters of a value a MySQL error can print: its messages hold
 * at most 512 bytes (MYSQL_ERRMSG_SIZE). MySQL 8.4.5 printed 128 characters
 * of a rejected value and 64 bytes of a duplicate key, for values of 1,500 to
 * 5,000 characters, as text and as `\xHH` escapes alike, and no message
 * longer than 179 bytes.
 */
const MAX_MYSQL_PRINTED_LENGTH = 512

/**
 * The ways a driver prints `text` into an error message: as it is, which is
 * how PostgreSQL prints it and MySQL prints most text; as MySQL prints the
 * key of a duplicate entry, with each character beyond three UTF-8 bytes as
 * `?` and nothing after a NUL; and as MySQL prints a rejected value. The two
 * MySQL forms stop at MAX_MYSQL_PRINTED_LENGTH, since MySQL prints no more.
 */
function printedText(text: string, whole: boolean, limit: number): PrintedValue[] {
  const forms = [upTo(text, whole, limit)]
  if (/[^\x20-\x7E]/.test(text)) {
    // Each MySQL form gives at least one character for every two of `text`,
    // so a longer text still gives a form past the limit, which is cut and
    // counts as the start of the value.
    const mysqlLimit = Math.min(limit, MAX_MYSQL_PRINTED_LENGTH)
    const head = text.slice(0, 2 * mysqlLimit + 2)
    const key = head.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '?')
    const nul = key.indexOf('\0')
    for (const form of [nul < 0 ? key : key.slice(0, nul), mysqlPrintable(utf8.encode(head), mysqlLimit)]) {
      const printed = upTo(form, whole, mysqlLimit)
      if (!forms.some(known => known.text === printed.text))
        forms.push(printed)
    }
  }
  return forms
}

/**
 * How a withheld `value` that is not an array can appear in an error `limit`
 * characters long. `json` gives the start of an object's JSON text.
 */
function printedItem(value: unknown, limit: number, json: (value: object) => string | undefined): PrintedValue[] {
  if (typeof value === 'string')
    return printedText(value.slice(0, limit), value.length <= limit, limit)
  if (isBytes(value)) {
    const bytes = bytesOf(value as ArrayBuffer | ArrayBufferView)
    return [upTo(mysqlPrintable(bytes.subarray(0, limit), limit), bytes.length <= limit, limit)]
  }
  if (typeof value === 'number' || typeof value === 'bigint')
    return typeof value === 'bigint' || Number.isFinite(value) ? [{ text: String(value), whole: true, number: true }] : []
  if (isStructured(value)) {
    const text = json(value)
    return text === undefined ? [] : printedText(text.slice(0, limit), text.length <= limit, limit)
  }
  // A date or a boolean is not looked for.
  return []
}

/**
 * How a withheld `value` can appear in an error `limit` characters long. No
 * more of a value than that can be in it, so no form is longer.
 *
 * MySQL prints an array as its JSON text, and PostgreSQL prints the items
 * Bun sent, joined by commas (`malformed array literal: "a,b"`), so the
 * value's JSON text counts, and each item that is not itself an array. An
 * array inside the value is printed by neither on its own: MySQL printed
 * `'[["alpha-one"],["bravo-two"]]'` whole, and PostgreSQL printed no inner
 * array, so its JSON text only goes into the value's. Counting it as well
 * gave a chain of arrays around one long string a copy per array. Arrays are
 * read depth first without recursion, each array's JSON text built from its
 * items' as they are read and only up to one character past `limit`, so no
 * array is written out more than once. A value past MAX_PRINTED_DEPTH, or
 * past what is left of `budget`, gives undefined.
 */
function printedValue(value: unknown, limit: number, budget: PrintBudget): PrintedValue[] | undefined {
  // The start of an object's JSON text, written out once however often the
  // value holds it.
  const heads = new Map<object, string | undefined>()
  const json = (item: object): string | undefined => {
    if (!heads.has(item))
      heads.set(item, jsonText(item)?.slice(0, limit + 1))
    return heads.get(item)
  }
  const forms: PrintedValue[] = []
  const add = (printed: PrintedValue[]): boolean => {
    for (const form of printed) {
      forms.push(form)
      budget.characters -= form.text.length
    }
    return budget.characters >= 0
  }
  if (--budget.items < 0)
    return undefined
  if (!Array.isArray(value))
    return add(printedItem(value, limit, json)) ? forms : undefined

  /** An array being read: its next item, and its JSON text so far. */
  interface Open { items: readonly unknown[], next: number, text: string | undefined }
  // An item's text goes on the end of its array's while that is still short
  // enough to matter; undefined, where JSON.stringify would throw, spreads
  // to every array around it.
  const append = (array: Open, item: string | undefined): void => {
    if (array.text !== undefined && array.text.length <= limit)
      array.text = item === undefined ? undefined : `${array.text}${array.next > 1 ? ',' : ''}${item}`
  }
  const open: Open[] = [{ items: value, next: 0, text: '[' }]
  while (open.length > 0) {
    const array = open.at(-1)!
    if (array.next < array.items.length) {
      const item = array.items[array.next++]
      if (--budget.items < 0)
        return undefined
      if (Array.isArray(item)) {
        if (open.length >= MAX_PRINTED_DEPTH)
          return undefined
        open.push({ items: item, next: 0, text: '[' })
        continue
      }
      if (!add(printedItem(item, limit, json)))
        return undefined
      if (array.text !== undefined && array.text.length <= limit) {
        // As JSON.stringify writes an array's item, only as much as can matter.
        append(array, typeof item === 'string'
          ? JSON.stringify(item.slice(0, limit + 1 - array.text.length))
          : item === undefined || typeof item === 'function' || typeof item === 'symbol'
            ? 'null'
            : typeof item === 'object' && item !== null ? json(item) : jsonText(item))
      }
      continue
    }
    open.pop()
    const text = array.text === undefined ? undefined : `${array.text}]`
    const around = open.at(-1)
    if (around)
      append(around, text)
    else if (text !== undefined && !add(printedText(text.slice(0, limit), text.length <= limit, limit)))
      return undefined
  }
  return forms
}

/**
 * A trie of the ways the withheld values can appear. An edge holds a run of
 * characters, `source` from the parent's depth to this node's, so the values
 * that share a start share nodes: a trie of n distinct copies has at most
 * 2n + 1 nodes, however long they are, and adding a copy reads each of its
 * characters at most once. Building it is linear in the number of copies
 * times their length, which is at most the length of the text read.
 */
interface CopyNode {
  source: string
  depth: number
  children?: Map<number, CopyNode>
  /** The copy that ends here, where one does. */
  end?: PrintedValue & { marker: string }
  /** Whether a copy at or below this node is of a value its binding redacts. */
  redacted: boolean
  /** The marker of a copy at or below this node. */
  marker: string
}

function addCopy(root: CopyNode, { text, whole }: PrintedValue, marker: string): void {
  const redacted = marker === REDACTED_BINDING
  let node = root
  let depth = 0
  for (;;) {
    node.redacted ||= redacted
    if (depth === text.length) {
      // The same copy of two values: it counts as whole only if both are,
      // and as redacted if either is.
      node.end = node.end
        ? { text, whole: node.end.whole && whole, marker: node.end.marker === REDACTED_BINDING ? REDACTED_BINDING : marker }
        : { text, whole, marker }
      return
    }
    const children = node.children ??= new Map()
    const child = children.get(text.charCodeAt(depth))
    if (!child) {
      children.set(text.charCodeAt(depth), { source: text, depth: text.length, end: { text, whole, marker }, redacted, marker })
      return
    }
    let at = depth + 1
    while (at < child.depth && at < text.length && text.charCodeAt(at) === child.source.charCodeAt(at))
      at++
    if (at < child.depth) {
      // The copy leaves this edge part way along it, so the edge is split.
      node = { source: child.source, depth: at, children: new Map([[child.source.charCodeAt(at), child]]), redacted: child.redacted, marker: child.marker }
      children.set(text.charCodeAt(depth), node)
    }
    else {
      node = child
    }
    depth = at
  }
}

/** Where a copy of a withheld value starts and ends, and what replaces it. */
interface Span {
  start: number
  end: number
  marker: string
}

/**
 * Where copies of the withheld values occur in `text`: a whole copy of a value
 * shorter than CUT_VALUE_LENGTH characters that stands as a word of its own,
 * or a copy of at least the first CUT_VALUE_LENGTH characters of a longer
 * value that does not continue a word before it, as far as it matches.
 *
 * From each position the trie is walked along `text` as far as it matches,
 * which finds the longest start of any value there in one walk, however many
 * values share it. A walk stops at the end of `text`, so a scan compares at
 * most n(n+1)/2 characters of a text n characters long, whatever the number of
 * values, with a Map lookup for each where the trie branches, and holds one
 * span per position. `text` is at most MAX_QUERY_LOG_ERROR_LENGTH +
 * CUT_VALUE_LENGTH characters.
 */
function scanForValues(text: string, root: CopyNode): Span[] {
  const spans: Span[] = []
  const words = new Uint8Array(text.length)
  for (let at = 0; at < text.length; at++)
    words[at] = WORD_CHAR.test(text[at]!) ? 1 : 0
  const word = (at: number): boolean => words[at] === 1
  for (let start = 0; start < text.length; start++) {
    // A copy that starts inside a longer word is part of that word.
    if (word(start) && word(start - 1))
      continue
    let end = start
    let marker: string | undefined
    let node = root
    let depth = 0
    let matched = 0
    // The node below which every copy shares the first CUT_VALUE_LENGTH
    // characters with the text here, once the walk gets that far.
    let cut: CopyNode | undefined
    for (;;) {
      const whole = node.end
      // A shorter copy counts where it is all of the value and ends a word.
      if (whole && depth < CUT_VALUE_LENGTH && !(whole.whole && word(start + depth - 1) && word(start + depth))) {
        end = start + depth
        marker = marker === REDACTED_BINDING ? marker : whole.marker
      }
      const child = start + depth < text.length ? node.children?.get(text.charCodeAt(start + depth)) : undefined
      if (!child)
        break
      let at = depth + 1
      while (at < child.depth && start + at < text.length && text.charCodeAt(start + at) === child.source.charCodeAt(at))
        at++
      matched = at
      if (!cut && at >= CUT_VALUE_LENGTH)
        cut = child
      if (at < child.depth)
        break
      node = child
      depth = at
    }
    if (cut) {
      end = start + matched
      marker = marker === REDACTED_BINDING || cut.redacted ? REDACTED_BINDING : cut.marker
    }
    if (marker !== undefined && end > start)
      spans.push({ start, end, marker })
  }
  return spans
}

/**
 * `error` as `query_logs.error` may keep it: at most
 * MAX_QUERY_LOG_ERROR_LENGTH characters of it, with each value its binding
 * does not keep replaced by that binding (`<redacted>`, `<string>`, ...)
 * where the driver printed it. MySQL prints the value of a duplicate entry
 * ("Duplicate entry '...' for key ...") and of a value a column rejects
 * ("Incorrect integer value: '...'"); PostgreSQL prints one it cannot parse
 * ("invalid input syntax for type uuid: \"...\""). A value is found as it
 * is and as MySQL escapes it (see {@link printedText}), whole where it stands
 * as a word of its own, and cut short from its first CUT_VALUE_LENGTH
 * characters on (see {@link scanForValues}).
 *
 * `entries` are {@link queryLogBindings} of `parameters`, and `secret` says
 * whether the value at an index would be `<redacted>` if values were kept,
 * which types alone do not. Text, JSON and bytes are taken out wherever
 * their binding is a marker, a copy of fewer than MIN_TYPED_COPY_LENGTH
 * characters only when the value is secret; a number only when it is
 * secret; a date or a boolean not at all. `secret` is asked only about a
 * value it decides something for, once. A value too deep to look for, or
 * values too many or too long together (see {@link printedValue}), leave
 * none of the error: the stored error is the marker of the binding where
 * reading stopped.
 */
export function queryLogError(
  error: string,
  parameters: readonly unknown[],
  entries: readonly unknown[],
  secret: (index: number) => boolean = index => entries[index] === REDACTED_BINDING,
): string {
  // A copy that starts before the limit is recognised as it would be in the
  // whole error: the text read runs CUT_VALUE_LENGTH characters past it.
  const truncated = error.length > MAX_QUERY_LOG_ERROR_LENGTH
  const text = truncated ? error.slice(0, MAX_QUERY_LOG_ERROR_LENGTH + CUT_VALUE_LENGTH) : error

  const root: CopyNode = { source: '', depth: 0, redacted: false, marker: '' }
  const budget: PrintBudget = { items: MAX_PRINTED_ITEMS, characters: MAX_PRINTED_CHARACTERS }
  let copies = 0
  for (const [index, value] of parameters.entries()) {
    const entry = entries[index]
    if (typeof entry !== 'string' || entry === value || (typeof value === 'bigint' && entry === String(value)))
      continue
    const printed = printedValue(value, text.length, budget)
    if (printed === undefined)
      return entry
    let isSecret: boolean | undefined
    for (const copy of printed) {
      // In production every number is a type, and taking out each id and
      // limit would turn "at row 1" into "at row <number>"; a copy this short
      // can spell the message's own words.
      if (copy.number || copy.text.length < MIN_TYPED_COPY_LENGTH) {
        isSecret ??= secret(index)
        if (!isSecret || copy.text.length === 0)
          continue
      }
      addCopy(root, copy, entry)
      copies++
    }
  }
  const spans = copies > 0 ? scanForValues(text, root) : []

  // Overlapping copies become one marker, `<redacted>` if any of them is.
  // Spans are found in order of their start.
  const limit = truncated ? MAX_QUERY_LOG_ERROR_LENGTH : text.length
  let kept = ''
  let at = 0
  for (let index = 0; index < spans.length && spans[index]!.start < limit;) {
    let { start, end, marker } = spans[index]!
    for (index++; index < spans.length && spans[index]!.start < end; index++) {
      end = Math.max(end, spans[index]!.end)
      if (spans[index]!.marker === REDACTED_BINDING)
        marker = REDACTED_BINDING
    }
    kept += text.slice(at, start) + marker
    at = end
  }
  if (!truncated)
    return kept + text.slice(at)
  // A copy running past the limit is replaced whole, and the text after it
  // is dropped with the rest.
  const cut = Math.max(at, MAX_QUERY_LOG_ERROR_LENGTH)
  return `${kept}${text.slice(at, cut)}<truncated: ${error.length - cut} more characters>`
}

/**
 * Whether the value at an index would be `<redacted>` if values were kept,
 * for a query whose bindings keep only types. Types do not say which values
 * are secret, and a number or a short copy only leaves the error when its
 * value is, so production must judge them as development does or it would
 * keep a one-time code that development takes out. {@link queryLogError}
 * asks only about a value whose answer decides something, so no other value
 * is read, and a value longer than MAX_JUDGED_LENGTH, counted as that
 * constant says, is taken to be secret without being read.
 */
function secretValues(sql: string, values: readonly unknown[]): (index: number) => boolean {
  let context: BindingContext | undefined
  return (index) => {
    const value = values[index]
    if (typeof value === 'string' ? value.length > MAX_JUDGED_LENGTH : isStructured(value) && jsonText(value, MAX_JUDGED_LENGTH) === TOO_LONG)
      return true
    context ??= bindingContext(sql)
    return keptValue(context, value, index) === REDACTED_BINDING
  }
}

export interface PersistedQueryLogValues {
  /** The JSON text the `bindings` column holds. */
  bindings: string
  /** The error text the `error` column holds, when there is one. */
  error?: string
}

/**
 * What a query log row keeps of the values a query bound: its `bindings`,
 * and `error` (the failed query's error text) without them.
 */
export function persistQueryLogValues(sql: string, parameters: unknown, error: string | undefined, options: QueryLogBindingOptions): PersistedQueryLogValues {
  const values = Array.isArray(parameters) ? parameters : [parameters]
  try {
    const entries = queryLogBindings(sql, values, options)
    if (error === undefined)
      return { bindings: JSON.stringify(entries) }
    const secret = options.captureValues ? undefined : secretValues(sql, values)
    return { bindings: JSON.stringify(entries), error: queryLogError(error, values, entries, secret) }
  }
  catch {
    // Nothing is known of the values, so the error keeps none of them, and
    // nothing of itself if they cannot be looked for.
    try {
      return { bindings: '[]', error: error === undefined ? undefined : queryLogError(error, values, values.map(() => REDACTED_BINDING), () => true) }
    }
    catch {
      return { bindings: '[]', error: error === undefined ? undefined : REDACTED_BINDING }
    }
  }
}

/** {@link queryLogBindings} as the JSON text the `bindings` column holds. */
export function serializeQueryLogBindings(sql: string, parameters: unknown, options: QueryLogBindingOptions): string {
  return persistQueryLogValues(sql, parameters, undefined, options).bindings
}
