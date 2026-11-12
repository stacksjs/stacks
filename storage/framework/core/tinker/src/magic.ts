/**
 * Magic comments: see a value where it is computed, without changing the code.
 *
 * ```ts
 * const users = User.all() //?                  the value of users
 * users.filter(u => u.active)/*?.length*\/.map(u => u.name) //?
 * slowThing() //?.                               how long the run took to get here
 * ```
 *
 * - `//?` at the end of a line shows the value of the statement that ends
 *   there: the names a declaration binds, or the expression itself.
 * - `/*?*\/` directly after an expression shows that expression's value and
 *   leaves it in place, so a chain can be inspected mid-way.
 * - `/*?.count()*\/` shows a property or call on that value instead of the
 *   value itself.
 * - `//?.` (or `/*?.*\/` at the end of a statement) shows the milliseconds
 *   since the run began.
 *
 * The transform rewrites the source in place and never adds or removes a line,
 * so every line number an error or a probe reports is the one the user sees.
 * It works from tokens, not a syntax tree, which is a deliberate limit: a
 * comment it cannot place with certainty is left alone as an ordinary comment
 * rather than guessed at.
 */

interface Token {
  type: 'ws' | 'nl' | 'comment' | 'string' | 'template' | 'regex' | 'number' | 'word' | 'punct'
  start: number
  end: number
  text: string
}

const PUNCTUATORS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>',
]

/** Words after which a `/` starts a regular expression rather than dividing. */
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await'])

/** Statements a probe cannot wrap as an expression. */
const NOT_AN_EXPRESSION = new Set(['if', 'for', 'while', 'do', 'switch', 'try', 'function', 'class', 'import', 'export', 'throw', 'break', 'continue', 'interface', 'type', 'enum', 'declare', 'namespace'])

function isWordStart(char: string): boolean {
  return /[\p{L}_$]/u.test(char)
}

function isWordPart(char: string): boolean {
  return /[\p{L}\p{N}_$]/u.test(char)
}

/** Where a template literal that opens at `from` ends, honouring `${ }` nesting. */
function templateEnd(code: string, from: number): number {
  let index = from + 1
  while (index < code.length) {
    const char = code[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '`')
      return index + 1
    if (char === '$' && code[index + 1] === '{') {
      index += 2
      let depth = 1
      while (index < code.length && depth > 0) {
        const inner = code[index]
        if (inner === '`') {
          index = templateEnd(code, index)
          continue
        }
        if (inner === '\'' || inner === '"') {
          index = stringEnd(code, index)
          continue
        }
        if (inner === '{')
          depth++
        else if (inner === '}')
          depth--
        index++
      }
      continue
    }
    index++
  }
  return code.length
}

function stringEnd(code: string, from: number): number {
  const quote = code[from]
  let index = from + 1
  while (index < code.length) {
    const char = code[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === quote || char === '\n')
      return index + 1
    index++
  }
  return code.length
}

function regexEnd(code: string, from: number): number {
  let index = from + 1
  let inClass = false
  while (index < code.length) {
    const char = code[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '\n')
      return -1
    if (char === '[')
      inClass = true
    else if (char === ']')
      inClass = false
    else if (char === '/' && !inClass) {
      index++
      while (index < code.length && /[a-z]/i.test(code[index]!))
        index++
      return index
    }
    index++
  }
  return -1
}

export function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  let lastSignificant: Token | undefined
  const push = (type: Token['type'], end: number): void => {
    const token = { type, start: index, end, text: code.slice(index, end) }
    tokens.push(token)
    if (type !== 'ws' && type !== 'nl' && type !== 'comment')
      lastSignificant = token
    index = end
  }

  while (index < code.length) {
    const char = code[index]!
    if (char === '\n') {
      push('nl', index + 1)
    }
    else if (char === ' ' || char === '\t' || char === '\r') {
      let end = index + 1
      while (end < code.length && (code[end] === ' ' || code[end] === '\t' || code[end] === '\r'))
        end++
      push('ws', end)
    }
    else if (char === '/' && code[index + 1] === '/') {
      let end = index + 2
      while (end < code.length && code[end] !== '\n')
        end++
      push('comment', end)
    }
    else if (char === '/' && code[index + 1] === '*') {
      const close = code.indexOf('*/', index + 2)
      push('comment', close === -1 ? code.length : close + 2)
    }
    else if (char === '\'' || char === '"') {
      push('string', stringEnd(code, index))
    }
    else if (char === '`') {
      push('template', templateEnd(code, index))
    }
    else if (char === '/') {
      const previous = lastSignificant
      const regexPossible = !previous
        || (previous.type === 'punct' && previous.text !== ')' && previous.text !== ']' && previous.text !== '}')
        || (previous.type === 'word' && REGEX_AFTER_WORD.has(previous.text))
      const end = regexPossible ? regexEnd(code, index) : -1
      if (end !== -1)
        push('regex', end)
      else
        push('punct', code[index + 1] === '=' ? index + 2 : index + 1)
    }
    else if (/\d/.test(char) || (char === '.' && /\d/.test(code[index + 1] ?? ''))) {
      let end = index + 1
      while (end < code.length && /[\w.]/.test(code[end]!))
        end++
      push('number', end)
    }
    else if (isWordStart(char) || char === '#') {
      let end = index + 1
      while (end < code.length && isWordPart(code[end]!))
        end++
      push('word', end)
    }
    else {
      const punctuator = PUNCTUATORS.find(candidate => code.startsWith(candidate, index))
      push('punct', index + (punctuator?.length ?? 1))
    }
  }
  return tokens
}

const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
const CLOSERS = new Set([')', ']', '}'])
const OPENING = new Set(['(', '[', '{'])

/** Punctuation that cannot end a statement: what follows on the next line continues it. */
const CONTINUES_AFTER = new Set(['.', '?.', ',', '(', '[', '=', '=>', '+', '-', '*', '/', '%', '**', '&&', '||', '??', '?', ':', '<', '>', '<=', '>=', '==', '===', '!=', '!==', '&', '|', '^', '!', '~', '+=', '-=', '*=', '/=', '??=', '||=', '&&='])
/** Punctuation that cannot start a statement: it continues the previous line. */
const CONTINUES_BEFORE = new Set(['.', '?.', ',', ')', ']', '=', '=>', '+', '-', '*', '/', '%', '**', '&&', '||', '??', '?', ':', '<', '>', '<=', '>=', '==', '===', '!=', '!==', '&', '|', '^'])
const CONTINUES_AFTER_WORD = new Set(['return', 'await', 'typeof', 'new', 'in', 'of', 'instanceof', 'yield', 'void', 'delete', 'const', 'let', 'var', 'as'])

function significant(token: Token | undefined): boolean {
  return Boolean(token) && token!.type !== 'ws' && token!.type !== 'nl' && token!.type !== 'comment'
}

function previousSignificant(tokens: Token[], from: number): number {
  for (let index = from; index >= 0; index--) {
    if (significant(tokens[index]))
      return index
  }
  return -1
}

function nextSignificant(tokens: Token[], from: number): number {
  for (let index = from; index < tokens.length; index++) {
    if (significant(tokens[index]))
      return index
  }
  return -1
}

/**
 * The index of the first token of the statement whose last token is `end`.
 * Returns -1 when the start cannot be told with confidence.
 */
function statementStart(tokens: Token[], end: number): number {
  let depth = 0
  let first = end
  for (let index = end; index >= 0; index--) {
    const token = tokens[index]!
    if (token.type === 'comment' || token.type === 'ws')
      continue

    if (token.type === 'nl') {
      if (depth > 0)
        continue
      const before = previousSignificant(tokens, index - 1)
      const after = nextSignificant(tokens, index + 1)
      if (before === -1)
        return first
      const prev = tokens[before]!
      const next = tokens[after]
      const continued = (prev.type === 'punct' && CONTINUES_AFTER.has(prev.text))
        || (prev.type === 'word' && CONTINUES_AFTER_WORD.has(prev.text))
        || (next?.type === 'punct' && CONTINUES_BEFORE.has(next.text))
      if (!continued)
        return first
      continue
    }

    if (token.type === 'punct') {
      if (CLOSERS.has(token.text)) {
        if (depth === 0 && token.text === '}') {
          // A closing brace on an earlier line, with a new statement after it, ends a block.
          const after = nextSignificant(tokens, index + 1)
          const newlineBetween = tokens.slice(index + 1, after === -1 ? undefined : after).some(inner => inner.type === 'nl')
          const next = after === -1 ? undefined : tokens[after]
          if (index !== end && newlineBetween && !(next?.type === 'punct' && CONTINUES_BEFORE.has(next.text)))
            return first
        }
        depth++
        first = index
        continue
      }
      if (OPENING.has(token.text)) {
        if (depth === 0)
          return first
        depth--
        first = index
        continue
      }
      if (depth === 0 && (token.text === ';' || token.text === '=>'))
        return first
    }
    first = index
  }
  return depth === 0 ? first : -1
}

/**
 * The first token of the member-and-call chain that ends just before `end`
 * (exclusive): `a.b(c)[0]`, `"x".length`, `(await f()).rows`. -1 when the
 * token before the comment is not the end of one.
 */
function chainStart(tokens: Token[], end: number): number {
  let index = previousSignificant(tokens, end - 1)
  if (index === -1 || index !== end - 1)
    return -1
  let first = -1
  let expectOperand = true
  while (index >= 0) {
    const token = tokens[index]!
    if (token.type === 'ws' || token.type === 'comment')
      break
    if (expectOperand) {
      if (token.type === 'punct' && (token.text === ')' || token.text === ']')) {
        // Skip the balanced group, then keep going: a call or an index needs its callee.
        let depth = 0
        let open = index
        for (; open >= 0; open--) {
          const inner = tokens[open]!
          if (inner.type !== 'punct')
            continue
          if (inner.text === token.text)
            depth++
          else if (inner.text === OPENERS[token.text])
            depth--
          if (depth === 0)
            break
        }
        if (open < 0)
          return -1
        first = open
        index = open - 1
        const before = tokens[index]
        // `f(x)` and `a[0]` continue to their callee; a bare `(x)` is the whole operand.
        if (before && (before.type === 'word' || (before.type === 'punct' && (before.text === ')' || before.text === ']')))) {
          expectOperand = true
          continue
        }
        expectOperand = false
        continue
      }
      if (token.type === 'word' || token.type === 'string' || token.type === 'template' || token.type === 'number' || token.type === 'regex') {
        first = index
        index--
        expectOperand = false
        continue
      }
      return -1
    }
    if (token.type === 'punct' && (token.text === '.' || token.text === '?.')) {
      index--
      expectOperand = true
      continue
    }
    break
  }
  if (first === -1 || expectOperand)
    return -1
  // `await x.y()` and `new Thing()` belong to the value being inspected.
  const lead = previousSignificant(tokens, first - 1)
  if (lead !== -1 && tokens[lead]!.type === 'word' && (tokens[lead]!.text === 'await' || tokens[lead]!.text === 'new'))
    first = lead
  return first
}

/** The names a `const`/`let`/`var` statement binds, as an expression that reads them. */
function boundNames(tokens: Token[], start: number, end: number): string | undefined {
  const first = nextSignificant(tokens, start + 1)
  if (first === -1 || first > end)
    return undefined
  const head = tokens[first]!
  if (head.type === 'word')
    return head.text
  if (head.type !== 'punct' || (head.text !== '{' && head.text !== '['))
    return undefined

  // A destructuring pattern: collect what it binds, which is every word not used as a key.
  const names: string[] = []
  let depth = 0
  for (let index = first; index <= end; index++) {
    const token = tokens[index]!
    if (token.type === 'punct' && OPENING.has(token.text))
      depth++
    else if (token.type === 'punct' && CLOSERS.has(token.text))
      depth--
    else if (token.type === 'word' && depth > 0) {
      const after = nextSignificant(tokens, index + 1)
      const before = previousSignificant(tokens, index - 1)
      const isKey = after !== -1 && tokens[after]!.text === ':'
      const isDefault = before !== -1 && tokens[before]!.text === '='
      if (!isKey && !isDefault)
        names.push(token.text)
    }
    if (depth === 0 && index > first)
      break
  }
  return names.length ? `{ ${names.join(', ')} }` : undefined
}

const LINE_MAGIC = /^\/\/\?(\.)?\s*$/
const BLOCK_MAGIC = /^\/\*\?(.*)\*\/$/s

export interface MagicProbe {
  /** Zero-based line the comment is on. */
  line: number
  kind: 'value' | 'time'
}

export interface Instrumented {
  code: string
  probes: MagicProbe[]
}

/** Whether a snippet has anything for the transform to do. A cheap test before tokenizing. */
export function hasMagicComments(code: string): boolean {
  return code.includes('//?') || code.includes('/*?')
}

/**
 * Rewrite magic comments into probe calls. `probe` and `time` name the
 * functions the session provides.
 */
export function instrumentMagicComments(code: string, names: { probe: string, time: string } = { probe: '__tinkerProbe', time: '__tinkerTime' }): Instrumented {
  if (!hasMagicComments(code))
    return { code, probes: [] }

  const probes: MagicProbe[] = []
  let result = code
  // Comments are handled from the last to the first, re-reading the text after
  // each rewrite. A probe inside a probed statement is then found in the
  // already rewritten text, and nothing to the left of the comment in hand has
  // moved. `bound` is where the next search stops.
  let bound = Number.POSITIVE_INFINITY

  for (let guard = 0; guard < 500; guard++) {
    const tokens = tokenize(result)
    let index = -1
    for (let candidate = tokens.length - 1; candidate >= 0; candidate--) {
      const token = tokens[candidate]!
      if (token.type === 'comment' && token.start < bound && (LINE_MAGIC.test(token.text) || BLOCK_MAGIC.test(token.text))) {
        index = candidate
        break
      }
    }
    if (index === -1)
      break

    const token = tokens[index]!
    const edit = placeProbe(result, tokens, index, names)
    if (!edit) {
      bound = token.start
      continue
    }
    result = result.slice(0, edit.start) + edit.text + result.slice(token.end)
    bound = edit.start + edit.text.length
    probes.unshift({ line: edit.line, kind: edit.kind })
  }

  return { code: result, probes }
}

function lineAt(code: string, offset: number): number {
  let line = 0
  for (let index = 0; index < offset; index++) {
    if (code.charCodeAt(index) === 10)
      line++
  }
  return line
}

/**
 * The rewrite for the magic comment at `index`: replace everything from
 * `start` to the end of the comment with `text`. Undefined when the comment
 * cannot be placed with certainty.
 */
function placeProbe(code: string, tokens: Token[], index: number, names: { probe: string, time: string }): { start: number, text: string, line: number, kind: MagicProbe['kind'] } | undefined {
  const token = tokens[index]!
  const lineMagic = LINE_MAGIC.exec(token.text)
  const blockMagic = lineMagic ? null : BLOCK_MAGIC.exec(token.text)
  const line = lineAt(code, token.start)
  const accessor = blockMagic ? blockMagic[1]!.trim() : ''
  const isTime = Boolean(lineMagic?.[1]) || accessor === '.'
  const pick = accessor && !isTime
    ? `, __v => __v${accessor.startsWith('.') || accessor.startsWith('[') || accessor.startsWith('?.') ? '' : '.'}${accessor}`
    : ''
  const last = previousSignificant(tokens, index - 1)
  if (last === -1)
    return undefined

  // A block comment hard against an expression inspects that expression in place.
  if (blockMagic && !isTime && last === index - 1) {
    const first = chainStart(tokens, index)
    if (first === -1)
      return undefined
    const expression = code.slice(tokens[first]!.start, tokens[last]!.end)
    return { start: tokens[first]!.start, text: `${names.probe}(${line}, (${expression})${pick})`, line, kind: 'value' }
  }

  // Otherwise the comment speaks for the statement that ends before it.
  let end = last
  if (tokens[end]!.type === 'punct' && tokens[end]!.text === ';')
    end = previousSignificant(tokens, end - 1)
  if (end === -1)
    return undefined
  const afterStatement = tokens[last]!.end
  const keep = code.slice(afterStatement, token.start).includes('\n') ? code.slice(afterStatement, token.start) : ''

  const start = statementStart(tokens, end)
  if (start === -1)
    return isTime ? { start: afterStatement, text: `${keep};${names.time}(${line})`, line, kind: 'time' } : undefined
  const head = tokens[start]!
  const statement = code.slice(head.start, tokens[end]!.end)

  if (isTime) {
    // An expression keeps its value, so timing the last line does not cost
    // the run its result. Anything else is timed by a call placed after it.
    const wrappable = !(head.type === 'word' && (head.text === 'const' || head.text === 'let' || head.text === 'var' || head.text === 'return' || NOT_AN_EXPRESSION.has(head.text)))
    return wrappable
      ? { start: head.start, text: `${names.time}(${line}, (${statement}))`, line, kind: 'time' }
      : { start: afterStatement, text: `${keep};${names.time}(${line})`, line, kind: 'time' }
  }

  if (head.type === 'word' && (head.text === 'const' || head.text === 'let' || head.text === 'var')) {
    const bound = boundNames(tokens, start, end)
    return bound ? { start: afterStatement, text: `;${names.probe}(${line}, ${bound}${pick})`, line, kind: 'value' } : undefined
  }
  if (head.type === 'word' && head.text === 'return') {
    const expression = code.slice(head.end, tokens[end]!.end).trim()
    return expression ? { start: head.start, text: `return ${names.probe}(${line}, (${expression})${pick})`, line, kind: 'value' } : undefined
  }
  if (head.type === 'word' && NOT_AN_EXPRESSION.has(head.text))
    return undefined
  return { start: head.start, text: `${names.probe}(${line}, (${statement})${pick})`, line, kind: 'value' }
}
