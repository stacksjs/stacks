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
 */
const CREDENTIAL_PATTERNS: ReadonlyArray<RegExp> = [
  /\$(?:2[abxy]?|argon2(?:id|i|d)|scrypt|pbkdf2[\w-]*|[156y])\$/, // modular crypt hashes: bcrypt, argon2, scrypt, sha-crypt
  /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/, // JWT
  /[\da-f]{32,}/i, // hex, also inside a key: digests, session ids, reset tokens
  /\b(?:sk|pk|rk)_(?:live|test)_\w{16,}/, // Stripe-shaped
  /\bAKIA[\dA-Z]{16}\b/, // AWS access key id
]

/** A run long enough to be a random token rather than a word or a slug. */
const OPAQUE_RUN = /[\w-]{32,}/g

export function looksLikeCredential(text: string): boolean {
  if (CREDENTIAL_PATTERNS.some(pattern => pattern.test(text)))
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

/** JSON text of a structured value, or undefined when it has none. */
function jsonText(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)
  }
  catch {
    return undefined
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
 * The bindings of `sql` as they may be persisted: one entry per parameter,
 * each the value itself, `<redacted>`, or a type tag such as `<string>`.
 */
export function queryLogBindings(sql: string, parameters: readonly unknown[], options: QueryLogBindingOptions): unknown[] {
  if (parameters.length === 0)
    return []

  const context = options.captureValues ? bindingContext(sql) : undefined
  return parameters.map((value, index) => {
    if (value === null || value === undefined)
      return null
    if (!context)
      return typeTag(value)

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
  })
}

/** {@link queryLogBindings} as the JSON text the `bindings` column holds. */
export function serializeQueryLogBindings(sql: string, parameters: unknown, options: QueryLogBindingOptions): string {
  const values = Array.isArray(parameters) ? parameters : [parameters]
  try {
    return JSON.stringify(queryLogBindings(sql, values, options))
  }
  catch {
    return '[]'
  }
}
