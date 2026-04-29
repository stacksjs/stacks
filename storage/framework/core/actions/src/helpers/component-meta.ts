/**
 * Component meta extraction for STX components.
 *
 * Replaces the old `vue-component-meta` integration. We don't ship Vue
 * anymore — `.stx` is the only template format Stacks supports — so this
 * module reads each `.stx` file directly, parses the `<script>` block for
 * `defineProps<…>()` (with or without `withDefaults`), scans the template
 * for `<slot>` and named slots, and pulls preceding JSDoc-style comments
 * onto each prop as its description.
 *
 * The output JSON shape is compatible with what the dashboard component
 * library expected from vue-component-meta — `{ props, events, slots }` —
 * so existing consumers don't need to change.
 *
 * Tradeoffs vs vue-component-meta:
 *  - We parse with regexes, not the TS compiler, so we won't resolve types
 *    imported from another file. That's a non-issue for the way STX
 *    components are written today (props live next to defineProps), and
 *    keeps the implementation dependency-free + fast.
 *  - We don't currently expand union types or follow `extends` chains.
 *    We capture the type as the source-text token; that's accurate enough
 *    for documentation rendering.
 */

import { frameworkPath, join, path, projectPath } from '@stacksjs/path'
import { existsSync, globSync, mkdirSync, writeFileSync } from '@stacksjs/storage'
import { readFileSync } from 'node:fs'

/**
 * Resolve `parseMarkdown` lazily so this module can run in environments that
 * don't have `ts-md` installed (the meta JSON it produces is still useful
 * for type/slot/event docs even without rich markdown rendering). When
 * ts-md is missing we just return the raw description.
 */
let parseMarkdownFn: ((s: string) => string) | null = null
async function getMarkdownParser(): Promise<(s: string) => string> {
  if (parseMarkdownFn) return parseMarkdownFn
  try {
    const mod = await import('ts-md')
    parseMarkdownFn = mod.parseMarkdown
  }
  catch {
    parseMarkdownFn = (s: string) => s
  }
  return parseMarkdownFn!
}

function renderDescription(raw: string): string {
  if (!raw) return ''
  // Avoid blocking the synchronous parse path on the markdown import. If
  // the parser hasn't been loaded yet we return the raw text — callers that
  // need rendered markdown should `await getMarkdownParser()` first.
  return parseMarkdownFn ? parseMarkdownFn(raw) : raw
}

export interface ComponentApiProp {
  name: string
  description: string
  type: string
  default: string
  required: boolean
}

export interface ComponentApiSlot {
  name: string
  description: string
}

export interface ComponentApiEvent {
  name: string
  type: string
  description: string
}

export interface ComponentApi {
  props: ComponentApiProp[]
  events: ComponentApiEvent[]
  slots: ComponentApiSlot[]
}

export async function generateComponentMeta(): Promise<void> {
  // Warm the markdown parser so descriptions render rich. If `ts-md` is
  // missing we still produce a valid meta JSON — descriptions just stay as
  // raw source text rather than rendered HTML.
  await getMarkdownParser()

  // STX is the only template format we ship; .vue support was dropped along
  // with vue-component-meta. Globbing both directories covers project layouts
  // that put components at `src/components/` AND framework defaults at
  // `storage/framework/defaults/resources/components/`.
  const components = globSync(
    [
      'components/*.stx',
      'components/**/*.stx',
      'resources/components/**/*.stx',
      'storage/framework/defaults/resources/components/**/*.stx',
    ],
    { cwd: projectPath(), absolute: true },
  )

  const metaDirPath = frameworkPath('component-meta')
  if (!existsSync(metaDirPath)) {
    mkdirSync(metaDirPath, { recursive: true })
  }

  for (const componentPath of components) {
    const componentExportName = path.parse(componentPath).name
    const meta = parseStxComponentMeta(componentPath)
    const metaJsonFilePath = join(metaDirPath, `${componentExportName}.json`)
    writeFileSync(metaJsonFilePath, JSON.stringify(meta, null, 2))
  }
}

/**
 * Read an `.stx` file and return its component API surface.
 */
export function parseStxComponentMeta(componentPath: string): ComponentApi {
  const source = readFileSync(componentPath, 'utf8')

  const scriptBlock = extractFirstScriptBlock(source)
  const templateBlock = extractTemplate(source)

  const props = scriptBlock ? extractProps(scriptBlock) : []
  const events = scriptBlock ? extractEvents(scriptBlock) : []
  const slots = extractSlots(templateBlock)

  return { props, events, slots }
}

// =============================================================================
// Script + template extraction
// =============================================================================

/**
 * Pull the *server* `<script>` block, falling back to the first `<script>`.
 * STX components keep their props/emits in the server script so the SSR
 * pass can read them; other scripts are client-side only.
 */
function extractFirstScriptBlock(source: string): string | null {
  const serverMatch = /<script\b[^>]*\bserver\b[^>]*>([\s\S]*?)<\/script>/i.exec(source)
  if (serverMatch) return serverMatch[1]
  const anyMatch = /<script\b[^>]*>([\s\S]*?)<\/script>/i.exec(source)
  return anyMatch ? anyMatch[1] : null
}

/**
 * Return the template region of an STX file. STX files often skip the
 * `<template>` wrapper, so when there isn't one we strip script/style
 * blocks and treat the rest as template.
 */
function extractTemplate(source: string): string {
  const templateMatch = /<template\b[^>]*>([\s\S]*?)<\/template>/i.exec(source)
  if (templateMatch) return templateMatch[1]
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

// =============================================================================
// Prop extraction
// =============================================================================

interface RawPropField {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
}

/**
 * Extract all `defineProps<…>()` and `withDefaults(defineProps<…>(), {…})`
 * shapes from the script. Supports:
 *   - inline:    defineProps<{ name: string }>()
 *   - aliased:   interface Foo {…}; defineProps<Foo>()
 *   - defaulted: const { x = 1 } = defineProps<{…}>()
 *   - explicit:  withDefaults(defineProps<{…}>(), { x: 1 })
 */
function extractProps(script: string): ComponentApiProp[] {
  const interfaces = collectInterfaces(script)
  const propsTypeBody = locatePropsType(script, interfaces)
  if (!propsTypeBody) return []

  const fields = parseTypeBody(propsTypeBody, interfaces)
  const defaults = extractDefaults(script)

  return fields.map((field) => {
    const merged: ComponentApiProp = {
      name: field.required ? field.name : `${field.name}?`,
      description: renderDescription(field.description),
      type: field.type,
      default: defaults[field.name] ?? field.default ?? 'unknown',
      required: field.required,
    }
    return merged
  })
}

/**
 * Map of interface/type name → raw body string (text inside `{…}`).
 * We index by name so `defineProps<MyProps>()` can resolve to its body.
 */
function collectInterfaces(script: string): Map<string, string> {
  const interfaces = new Map<string, string>()
  const ifaceRe = /(?:export\s+)?interface\s+([A-Z][\w$]*)\s*(?:extends\s+[\w$,\s]+)?\s*\{/g
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = ifaceRe.exec(script)) !== null) {
    const name = m[1]
    const start = m.index + m[0].length
    const body = sliceBalanced(script, start - 1, '{', '}')
    if (body !== null) interfaces.set(name, body)
  }
  // type Foo = { … }
  const typeAliasRe = /(?:export\s+)?type\s+([A-Z][\w$]*)\s*=\s*\{/g
  // eslint-disable-next-line no-cond-assign
  while ((m = typeAliasRe.exec(script)) !== null) {
    const name = m[1]
    const start = m.index + m[0].length
    const body = sliceBalanced(script, start - 1, '{', '}')
    if (body !== null) interfaces.set(name, body)
  }
  return interfaces
}

/**
 * Find the type body that drives `defineProps<…>()`. Returns the raw text
 * between the type's outer braces, ready for parseTypeBody.
 */
function locatePropsType(script: string, interfaces: Map<string, string>): string | null {
  // defineProps<{ … }>()  or  defineProps<Name>()  — possibly wrapped in withDefaults.
  const defineRe = /defineProps\s*<\s*([\s\S]+?)\s*>\s*\(/
  const match = defineRe.exec(script)
  if (!match) return null
  const generic = match[1].trim()

  if (generic.startsWith('{')) {
    // Inline literal: re-read the brace-balanced body relative to the original script
    const braceStart = script.indexOf('{', match.index)
    return sliceBalanced(script, braceStart, '{', '}')
  }

  // Named reference — strip generic params (`Foo<X>`) and intersection (`A & B`)
  // and look up the leading identifier.
  const ref = generic.replace(/[<>(].*$/, '').split('&')[0].trim()
  return interfaces.get(ref) ?? null
}

/**
 * Parse `key: type` lines out of an interface body. Carries through
 * leading JSDoc and line comments as the description.
 */
function parseTypeBody(body: string, interfaces: Map<string, string>): RawPropField[] {
  const fields: RawPropField[] = []
  // Split into statements at the top level (semicolons or newlines), but not
  // inside nested braces / parens / generics. Walk char-by-char.
  const statements = splitTopLevel(body, [';', '\n'])

  let pendingDoc = ''
  for (const raw of statements) {
    const stmt = raw.trim()
    if (!stmt) continue

    // Capture JSDoc/line comment that precedes the next field.
    const docMatch = /^\/\*\*([\s\S]*?)\*\/\s*([\s\S]*)$/.exec(stmt)
    if (docMatch) {
      pendingDoc = docMatch[1].split('\n').map(l => l.replace(/^\s*\*\s?/, '')).join('\n').trim()
      const remainder = docMatch[2].trim()
      if (!remainder) continue
      const field = parseFieldLine(remainder, pendingDoc, interfaces)
      if (field) fields.push(field)
      pendingDoc = ''
      continue
    }
    if (stmt.startsWith('//')) {
      pendingDoc = stmt.replace(/^\/\/\s?/, '')
      continue
    }

    const field = parseFieldLine(stmt, pendingDoc, interfaces)
    if (field) fields.push(field)
    pendingDoc = ''
  }

  return fields
}

/**
 * Parse a single `name?: Type` line. Returns null for non-field lines
 * (commas, stray punctuation, empty strings).
 */
function parseFieldLine(line: string, description: string, _interfaces: Map<string, string>): RawPropField | null {
  // Skip method-shaped fields like `onClick(): void` — those describe component
  // methods, not props, and we'd misrepresent their type.
  if (/^[a-zA-Z_$][\w$]*\s*\(/.test(line.trimStart())) return null

  const m = /^([a-zA-Z_$][\w$]*)\s*(\??)\s*:\s*([\s\S]+?)\s*[;,]?\s*$/.exec(line)
  if (!m) return null
  const [, name, optional, type] = m
  return {
    name,
    type: collapseWhitespace(type),
    required: optional !== '?',
    description,
  }
}

/**
 * Pull defaults out of:
 *   - destructuring:  const { a = 1, b = 'x' } = defineProps<…>()
 *   - withDefaults:   withDefaults(defineProps<…>(), { a: 1, b: 'x' })
 */
function extractDefaults(script: string): Record<string, string> {
  const defaults: Record<string, string> = {}

  // Destructuring defaults
  const destructRe = /const\s*\{\s*([\s\S]*?)\s*\}\s*=\s*(?:withDefaults\s*\(\s*)?defineProps/g
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = destructRe.exec(script)) !== null) {
    parseDestructDefaults(m[1], defaults)
  }

  // withDefaults(_, { … })  — walk past the inner defineProps<…>() then
  // consume the second-arg object literal.
  const withDefaultsIdx = script.indexOf('withDefaults(')
  if (withDefaultsIdx >= 0) {
    const afterDefine = script.indexOf('defineProps', withDefaultsIdx)
    if (afterDefine > 0) {
      const generic = script.indexOf('>', afterDefine)
      const closeParen = script.indexOf(')', generic >= 0 ? generic : afterDefine)
      if (closeParen > 0) {
        const commaIdx = script.indexOf(',', closeParen)
        const objStart = commaIdx >= 0 ? script.indexOf('{', commaIdx) : -1
        if (objStart > 0) {
          const body = sliceBalanced(script, objStart, '{', '}')
          if (body) parseObjectDefaults(body, defaults)
        }
      }
    }
  }

  return defaults
}

function parseDestructDefaults(destructBody: string, out: Record<string, string>): void {
  for (const part of splitTopLevel(destructBody, [','])) {
    const m = /^\s*([a-zA-Z_$][\w$]*)\s*=\s*([\s\S]+?)\s*$/.exec(part)
    if (m) out[m[1]] = collapseWhitespace(m[2])
  }
}

function parseObjectDefaults(objectBody: string, out: Record<string, string>): void {
  for (const part of splitTopLevel(objectBody, [','])) {
    const m = /^\s*([a-zA-Z_$][\w$]*)\s*:\s*([\s\S]+?)\s*$/.exec(part.trim())
    if (m) out[m[1]] = collapseWhitespace(m[2])
  }
}

// =============================================================================
// Event extraction (defineEmits)
// =============================================================================

function extractEvents(script: string): ComponentApiEvent[] {
  const m = /defineEmits\s*<\s*\{([\s\S]*?)\}\s*>\s*\(/.exec(script)
  if (!m) return []
  const events: ComponentApiEvent[] = []
  for (const part of splitTopLevel(m[1], [';', '\n'])) {
    const trimmed = part.trim()
    if (!trimmed) continue
    // Format options: `'click': [arg: T]` or `click(arg: T): void`
    const tuple = /^['"]?([\w-]+)['"]?\s*:\s*\[(.*?)\]\s*$/.exec(trimmed)
    if (tuple) {
      events.push({ name: tuple[1], type: tuple[2].trim() || 'void', description: '' })
      continue
    }
    const fn = /^([a-zA-Z_$][\w$]*)\s*\(([\s\S]*?)\)\s*:\s*([\s\S]+)$/.exec(trimmed)
    if (fn) {
      events.push({ name: fn[1], type: fn[2].trim(), description: '' })
    }
  }
  return events
}

// =============================================================================
// Slot extraction
// =============================================================================

function extractSlots(template: string): ComponentApiSlot[] {
  const slots: ComponentApiSlot[] = []
  const seen = new Set<string>()

  // Self-closing or paired <slot>, optionally with `name="x"`.
  const slotRe = /<slot\b([^>]*)>/g
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = slotRe.exec(template)) !== null) {
    const attrs = m[1] || ''
    const nameMatch = /\bname\s*=\s*["']([^"']+)["']/.exec(attrs)
    const name = nameMatch ? nameMatch[1] : 'default'
    if (seen.has(name)) continue
    seen.add(name)
    slots.push({ name, description: '' })
  }
  return slots
}

// =============================================================================
// Lightweight syntax helpers
// =============================================================================

/**
 * Walk `source` from `openIdx` (which must point at `open`) and return the
 * substring between the matched braces. Skips quoted strings + nested
 * pairs. Returns `null` if no matching close is found.
 */
function sliceBalanced(source: string, openIdx: number, open: string, close: string): string | null {
  if (source[openIdx] !== open) return null
  let depth = 0
  let i = openIdx
  let inString: string | null = null
  while (i < source.length) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') { i += 2; continue }
      if (ch === inString) inString = null
      i++
      continue
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch
      i++
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(openIdx + 1, i)
    }
    i++
  }
  return null
}

/**
 * Split a string by any of `separators` at top brace/paren/generic depth
 * (and not inside strings). Used for both interface bodies and destructures
 * where commas/semicolons inside `[A, B]` or `Map<K, V>` shouldn't split.
 */
function splitTopLevel(source: string, separators: string[]): string[] {
  const out: string[] = []
  const sepSet = new Set(separators)
  let depth = 0
  let inString: string | null = null
  let start = 0
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = ch
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth++
    else if (ch === '}' || ch === ']' || ch === ')' || ch === '>') depth--
    else if (depth === 0 && sepSet.has(ch)) {
      out.push(source.slice(start, i))
      start = i + 1
    }
  }
  out.push(source.slice(start))
  return out
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}
