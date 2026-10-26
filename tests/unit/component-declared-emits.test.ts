import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A component declares every event it emits (stacksjs/stacks#3016).
 *
 * stx gives a component listener the native events that bubble out of the
 * component too, as Vue does, until the component declares or emits that
 * name. A dialog calling a bare `defineEmits()` that refused its own input
 * emitted `invalid`, so the form's native `submit` reached the page's
 * `@submit="saveKey"`, which posted `{"isTrusted":true}` to the API and showed
 * three wrong "required" errors.
 */
const ROOT = join(import.meta.dir, '../../storage/framework/defaults/resources')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.stx') ? [join(dir, entry.name)] : [])
}

const LITERAL = /^\s*(['"])([^'"]+)\1\s*$/

/** The names a `defineEmits(...)` argument declares, or null when it is not a literal list. */
function declaredNames(args: string): string[] | null {
  const list = args.trim()
  if (!list)
    return []
  if (!list.startsWith('[') || !list.endsWith(']'))
    return null
  return list.slice(1, -1).split(',').map(item => item.trim()).filter(Boolean).map((item) => {
    const literal = LITERAL.exec(item)
    return literal ? literal[2]! : `<${item}>`
  })
}

function problems(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const definition = /const\s+(\w+)\s*=\s*defineEmits(?:<[^>]*>)?\(([^)]*)\)/.exec(source)
  if (!definition)
    return []
  const [, emit, args] = definition
  const declared = declaredNames(args!)
  if (declared === null)
    return [`declares its events in a form this check cannot read: defineEmits(${args})`]

  const emitted = new Set<string>()
  const dynamic: string[] = []
  for (const call of source.matchAll(new RegExp(`\\b${emit}\\(\\s*([^,)]+)`, 'g'))) {
    const argument = call[1]!.trim()
    const literal = LITERAL.exec(argument)
    // `next ? 'open' : 'close'`, or a parameter typed as a union of names.
    const choices = /^\w+\s*\?\s*(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3$/.exec(argument)
    const union = /^\w+$/.test(argument)
      ? new RegExp(`\\b${argument}:\\s*((?:(['"])[^'"]+\\2\\s*\\|?\\s*)+)`).exec(source)
      : null
    if (literal)
      emitted.add(literal[2]!)
    else if (choices)
      emitted.add(choices[2]!).add(choices[4]!)
    else if (union)
      for (const name of union[1]!.matchAll(/(['"])([^'"]+)\1/g)) emitted.add(name[2]!)
    else
      dynamic.push(argument)
  }
  // A table re-emits its row actions by name; those names are the actions it lists.
  if (dynamic.length > 0) {
    const actions = [...source.matchAll(/\baction:\s*(['"])([^'"]+)\1/g)].map(match => match[2]!)
    if (actions.length === 0)
      return [`emits ${dynamic.join(', ')}, whose names cannot be read`]
    for (const action of actions)
      emitted.add(action)
  }

  return [...emitted].filter(name => !declared.includes(name)).map(name => `emits '${name}' without declaring it`)
}

describe('default components', () => {
  it('declare every event they emit', () => {
    const offenders = walk(ROOT).flatMap(file => problems(file).map(problem => `${relative(ROOT, file)}: ${problem}`))
    expect(offenders).toEqual([])
  })
})
