import { parse } from '@babel/parser'

/**
 * Settling: outside a function, a snippet reads as if it ran in order.
 *
 * ```ts
 * const user = User.where('email', 'like', '%@example.com').first()
 * user.email                       // the row's email, not undefined
 * User.first().email               // works mid-expression too
 * if (User.where('active', true).exists()) dump(User.count())
 * ```
 *
 * A query is a promise, and a promise nobody awaited is a value that is not
 * there yet: `user` above would be the pending promise, `user.email` would be
 * undefined, and the result panel would say "Promise". Every other language a
 * tinker tool is used from runs a query where it is written, so that is what
 * a snippet does here.
 *
 * The rule: outside a function, a call that returns a promise is waited for
 * where it stands, and so is a promise a statement names (the value of a
 * line, of a declaration, of an assignment). Inside a function nothing
 * changes, because a function may be called from anywhere and `await` there
 * is the author's to write.
 *
 * What is deliberately left a promise, because the code is handling it as
 * one: the receiver of `.then()`, `.catch()` or `.finally()`, the arguments
 * of `Promise.all()` and its siblings, the operand of `void`, and anything
 * already under `await`.
 *
 * Only a real `Promise` is waited for. A query builder that happens to be
 * thenable is not, so `const query = User.where(...)` keeps the builder.
 * And only a promise causes a wait at all: a snippet that produces none runs
 * exactly as it would have, in the same order and in the same turn.
 *
 * The rewrite is a set of insertions into the source. It never moves, adds or
 * removes a line, and it is driven by a syntax tree, not by tokens: a snippet
 * the parser cannot read is returned untouched for the runtime to report.
 */

interface Node {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

/** What goes before and after an expression that is to be settled. */
export interface SettleWrap {
  open: string
  close: string
}

/** One insertion into the original text, at `at`. */
export interface SettleEdit {
  at: number
  text: string
}

export interface Settled {
  code: string
  /** The insertions that turn the original into `code`, in order. */
  edits: SettleEdit[]
}

export interface SettleOptions {
  /** The text an expression is wrapped in. Default: the runtime form a session evaluates. */
  wrap?: SettleWrap
  /**
   * Calls that hand their value straight back, so the value is settled and
   * the call is not: the probes magic comments are rewritten into.
   */
  transparent?: string[]
}

/**
 * The runtime form. `__tinkerPending(value)` keeps the value and says whether
 * it is a promise; `__tinkerTake()` hands it back. A value that is not a
 * promise never reaches `await`, which is what keeps code with no promise in
 * it running in one turn.
 */
export const SETTLE_RUNTIME_WRAP: SettleWrap = {
  open: '(__tinkerPending(',
  close: ') ? await __tinkerTake() : __tinkerTake())',
}

/**
 * The form a type checker reads. A language service that wants `user` in
 * `const user = User.first()` typed as the row, as it is when the snippet
 * runs, checks the snippet rewritten with this wrap and with
 * `SETTLE_TYPE_AMBIENT` in scope, and maps positions through `edits`.
 */
export const SETTLE_TYPE_WRAP: SettleWrap = {
  open: '__tinkerSettled(',
  close: ')',
}

/**
 * `T | Promise<T>` rather than a conditional type: the contextual type still
 * reaches the argument (`const tags: Set<string> = new Set()` stays valid),
 * and a thenable that is not a `Promise` is left alone, as it is at runtime.
 */
export const SETTLE_TYPE_AMBIENT = 'declare function __tinkerSettled<T>(value: T | Promise<T>): T\n'

/** The calls magic comments are rewritten into (see magic.ts). */
export const SETTLE_TRANSPARENT: string[] = ['__tinkerProbe', '__tinkerTime']

const CALLS = new Set(['CallExpression', 'OptionalCallExpression', 'NewExpression', 'TaggedTemplateExpression', 'ImportExpression'])
/** Where `await` is not the snippet's to add: a function runs later, a class body and a TypeScript declaration cannot hold one. */
const OPAQUE = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
  'ClassDeclaration',
  'ClassExpression',
])
/** TypeScript syntax that is an expression around another expression. */
const TS_EXPRESSIONS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'TSInstantiationExpression'])
const SKIPPED_KEYS = new Set(['loc', 'extra', 'typeAnnotation', 'typeArguments', 'typeParameters', 'returnType', 'decorators', 'leadingComments', 'trailingComments', 'innerComments'])
const PROMISE_METHODS = new Set(['then', 'catch', 'finally'])
const STATEMENT_LISTS = new Set(['Program', 'BlockStatement', 'SwitchCase', 'StaticBlock'])
const ASSIGNS_VALUE = new Set(['=', '||=', '&&=', '??='])

function isNode(value: unknown): value is Node {
  return Boolean(value) && typeof value === 'object' && typeof (value as Node).type === 'string' && typeof (value as Node).start === 'number'
}

function memberName(node: Node): string | undefined {
  if ((node.type !== 'MemberExpression' && node.type !== 'OptionalMemberExpression') || node.computed)
    return undefined
  const property = node.property as Node
  return property.type === 'Identifier' ? property.name as string : undefined
}

/** `Promise.all(...)`, `Promise.race(...)`: the arguments are promises on purpose. */
function isPromiseStatic(node: Node): boolean {
  if (node.type !== 'CallExpression')
    return false
  const callee = node.callee as Node
  const object = callee.object as Node | undefined
  return callee.type === 'MemberExpression' && !callee.computed && object?.type === 'Identifier' && object.name === 'Promise'
}

/** The tree to walk, and how far its offsets are from the snippet's own. */
function parseSnippet(code: string): { root: Node, shift: number } | undefined {
  const read = (text: string): Node => (parse(text, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators'],
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    allowUndeclaredExports: true,
  }) as unknown as { program: Node }).program

  // A snippet that opens with a brace is read as an object first, the way a
  // REPL reads it: `{ users: User.count() }` is a value, not a block.
  if (/^\s*\{/.test(code)) {
    try {
      const program = read(`(${code}\n)`)
      const body = program.body as Node[]
      if (body.length === 1 && body[0]!.type === 'ExpressionStatement' && (body[0]!.expression as Node).type === 'ObjectExpression')
        return { root: body[0]!.expression as Node, shift: 1 }
    }
    catch {
      // Not an object: a block, read below.
    }
  }
  try {
    return { root: read(code), shift: 0 }
  }
  catch {
    return undefined
  }
}

/**
 * Rewrite a snippet so that promises at its top level are waited for.
 * Returns the code unchanged when there is nothing to wait for, or when it
 * does not parse.
 */
export function settleTopLevel(code: string, options: SettleOptions = {}): Settled {
  const wrap = options.wrap ?? SETTLE_RUNTIME_WRAP
  const transparent = new Set(options.transparent ?? SETTLE_TRANSPARENT)
  const parsed = parseSnippet(code)
  if (!parsed)
    return { code, edits: [] }

  const wrapped = new Set<Node>()
  /** Statements that now open with a parenthesis and sit in a list, where the line before could swallow it. */
  const guarded = new Set<number>()

  const isTransparentCall = (node: Node): boolean => {
    const callee = node.callee as Node | undefined
    return node.type === 'CallExpression' && callee?.type === 'Identifier' && transparent.has(callee.name as string)
  }

  /** Whether the call `node`, found under `parent[key]`, is to be settled where it stands. */
  const settlesCall = (node: Node, parent: Node | undefined, key: string): boolean => {
    if (isTransparentCall(node))
      return false
    if (!parent)
      return true
    if (parent.type === 'AwaitExpression')
      return false
    if (parent.type === 'UnaryExpression' && parent.operator === 'void')
      return false
    if (key === 'object' && PROMISE_METHODS.has(memberName(parent) ?? ''))
      return false
    // Inside an optional chain the links share one short circuit. Settling a
    // link in the middle would cut it, so the chain is settled as a whole.
    if ((parent.type === 'OptionalMemberExpression' || parent.type === 'OptionalCallExpression') && parent.optional === false && (key === 'object' || key === 'callee'))
      return false
    // Not a value position: an assignment target is not read.
    if ((parent.type === 'AssignmentExpression' && key === 'left') || parent.type === 'UpdateExpression' || ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && key === 'left'))
      return false
    return true
  }

  /**
   * A value a statement names: settle it if it can be a promise that no call
   * rule has already settled. Branches are settled one by one, so the branch
   * not taken costs nothing.
   */
  const settleValue = (node: Node | null | undefined): void => {
    if (!isNode(node))
      return
    if (TS_EXPRESSIONS.has(node.type) || node.type === 'ParenthesizedExpression')
      return settleValue(node.expression as Node)
    switch (node.type) {
      case 'Identifier':
        if (node.name !== 'undefined')
          wrapped.add(node)
        return
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        wrapped.add(node)
        return
      case 'AssignmentExpression':
        if (ASSIGNS_VALUE.has(node.operator as string))
          settleValue(node.right as Node)
        return
      case 'ConditionalExpression':
        settleValue(node.consequent as Node)
        settleValue(node.alternate as Node)
        return
      case 'LogicalExpression':
        settleValue(node.left as Node)
        settleValue(node.right as Node)
        return
      case 'SequenceExpression': {
        const expressions = node.expressions as Node[]
        settleValue(expressions[expressions.length - 1])
      }
    }
  }

  const visit = (node: Node, parent: Node | undefined, key: string): void => {
    if (OPAQUE.has(node.type))
      return
    if (node.type.startsWith('TS')) {
      if (TS_EXPRESSIONS.has(node.type))
        visit(node.expression as Node, node, 'expression')
      return
    }

    if (CALLS.has(node.type) && settlesCall(node, parent, key))
      wrapped.add(node)

    if (node.type === 'ExpressionStatement') {
      settleValue(node.expression as Node)
    }
    else if (node.type === 'VariableDeclarator') {
      settleValue(node.init as Node)
    }
    else if (node.type === 'ExportDefaultDeclaration') {
      settleValue(node.declaration as Node)
    }
    else if (isTransparentCall(node)) {
      // `__tinkerProbe(line, value)`: the probe reports what the statement is worth.
      settleValue((node.arguments as Node[])[1])
    }

    const promiseStatic = isPromiseStatic(node)
    for (const childKey of Object.keys(node)) {
      if (SKIPPED_KEYS.has(childKey) || (promiseStatic && childKey === 'arguments'))
        continue
      const child = node[childKey]
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isNode(item))
            visit(item, node, childKey)
        }
      }
      else if (isNode(child)) {
        visit(child, node, childKey)
      }
    }

    if (node.type === 'ExpressionStatement' && parent && STATEMENT_LISTS.has(parent.type))
      guarded.add(node.start)
  }

  const { root, shift } = parsed
  visit(root, undefined, '')

  if (!wrapped.size)
    return { code, edits: [] }

  // At one offset: what closes goes first (the inner before the outer), then
  // what opens (the outer before the inner).
  const nodes = [...wrapped]
  const closes = nodes.slice().sort((a, b) => a.end - b.end || b.start - a.start)
  const opens = nodes.slice().sort((a, b) => a.start - b.start || b.end - a.end)
  const edits: SettleEdit[] = []
  let closing = 0
  let opening = 0
  while (closing < closes.length || opening < opens.length) {
    const close = closes[closing]
    const open = opens[opening]
    if (close && (!open || close.end <= open.start)) {
      edits.push({ at: close.end - shift, text: wrap.close })
      closing++
    }
    else if (open) {
      // A line that now starts with a parenthesis would be read as a call on
      // the line above it. The semicolon ends that line first.
      const guard = guarded.delete(open.start) ? ';' : ''
      edits.push({ at: open.start - shift, text: guard + wrap.open })
      opening++
    }
  }

  let result = ''
  let cursor = 0
  for (const edit of edits) {
    result += code.slice(cursor, edit.at) + edit.text
    cursor = edit.at
  }
  result += code.slice(cursor)
  return { code: result, edits }
}

/** Where an offset in the original text is in the rewritten text. */
export function settledOffset(edits: SettleEdit[], offset: number): number {
  let moved = offset
  for (const edit of edits) {
    if (edit.at > offset)
      break
    moved += edit.text.length
  }
  return moved
}

/** Where an offset in the rewritten text is in the original. An offset inside an insertion maps to where it was inserted. */
export function originalOffset(edits: SettleEdit[], offset: number): number {
  let added = 0
  for (const edit of edits) {
    const start = edit.at + added
    if (offset < start)
      break
    if (offset < start + edit.text.length)
      return edit.at
    added += edit.text.length
  }
  return offset - added
}

const RUNTIME_OPEN = /__tinkerPending\(/g
const RUNTIME_CLOSE = /\)\s*\?\s*await __tinkerTake\(\)\s*:\s*__tinkerTake\(\)/g

/**
 * Take the runtime form back out of a message. An engine quotes the code it
 * was evaluating when it failed, and that is the rewritten code: without this
 * a `TypeError` would show the user text they never wrote.
 */
export function unsettleText(text: string): string {
  return text.includes('__tinkerPending(')
    ? text.replace(RUNTIME_OPEN, '').replace(RUNTIME_CLOSE, '')
    : text
}
