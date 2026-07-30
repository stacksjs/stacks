/**
 * Read & write `config/*.ts` files from the dashboard.
 *
 * Why this exists
 * ---------------
 * Config files use `export default { ... } satisfies XConfig` and pull
 * defaults from `env.*`. The settings page needs to:
 *   - List every config file
 *   - Show its currently-resolved values (env-substituted)
 *   - Persist edits back to the source `.ts` so they survive restarts
 *
 * Reading is straightforward: `await import(file)` returns the evaluated
 * object. Writing is harder — we want to preserve comments, type imports,
 * and the `env.*` references intact. Instead of regenerating the file,
 * we mutate the source text in place: find the line containing
 * `<key>: <oldValue>` and rewrite the value. This keeps the file
 * round-trippable and human-readable.
 *
 * Edits supported (top-level scalar keys only):
 *   - string  →  string  (single- or double-quoted)
 *   - number  →  number
 *   - boolean →  boolean
 *
 * Edits NOT supported (the settings UI surfaces a read-only badge):
 *   - nested objects, arrays
 *   - keys whose current value is a function call or expression
 *     (`env.X ?? 'y'`) — those need to be edited via env, not config
 */

import { chmodSync, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

let projectRootCache: string | null = null
function projectRoot(): string {
  if (projectRootCache) return projectRootCache
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'config'))) {
      projectRootCache = dir
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  projectRootCache = process.cwd()
  return projectRootCache
}

function configDir(): string {
  return resolve(projectRoot(), 'config')
}

export interface ConfigFileSummary {
  /** Filename without extension, e.g. 'email'. */
  name: string
  /** Display title, e.g. 'Email'. */
  title: string
  /** Absolute path to the source file. */
  path: string
  /** Bytes — UI uses this to show "small / large config" hints. */
  size: number
}

/** Enumerate every `.ts` config file. Hidden / non-ts files are skipped. */
export function listConfigFiles(): ConfigFileSummary[] {
  const dir = configDir()
  if (!existsSync(dir)) return []
  let entries: string[]
  try { entries = readdirSync(dir) }
  catch { return [] }
  const out: ConfigFileSummary[] = []
  for (const e of entries) {
    if (!e.endsWith('.ts') || e.startsWith('.')) continue
    const path = join(dir, e)
    let size = 0
    try { size = Bun.file(path).size }
    catch { /* unreadable — leave at 0 */ }
    const name = e.replace(/\.ts$/, '')
    out.push({ name, title: titleCase(name), path, size })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Cache of imported config modules. We re-import on every call when the
 * file's mtime has changed so the dashboard reflects edits immediately,
 * but skip the cost when nothing has changed in a tight burst of reads.
 */
const moduleCache = new Map<string, { mtimeMs: number, value: any }>()

export interface ReadResult {
  /** The fully-resolved default export, with env values substituted. */
  values: any
  /** Raw source text (used by the editor + the writer). */
  source: string
  /** Per-key metadata: what's editable, what's read-only and why. */
  fields: ConfigField[]
}

export interface ConfigField {
  key: string
  /** The currently-resolved value (post env substitution). */
  value: any
  /** 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' */
  type: string
  /** True when this scalar can be safely round-tripped on write. */
  editable: boolean
  /** Human-readable reason when editable === false. */
  reason?: string
}

/** Read one config file by name (e.g. 'email'). */
export async function readConfig(name: string): Promise<ReadResult | null> {
  const path = join(configDir(), `${name}.ts`)
  if (!existsSync(path)) return null

  const stat = await Bun.file(path).stat?.().catch(() => null)
  const mtimeMs = stat?.mtimeMs ?? Date.now()

  // Read the source as the source-of-truth for the field listing.
  // We deliberately do NOT re-`import()` the file after every edit — Bun
  // caches modules by URL, query-string cache-busting (`?t=…`) caused
  // intermittent 0-status responses for some configs (likely when the
  // resolved value held a function or unsupported sentinel). The source
  // text + a one-off initial import gives us everything the editor
  // needs without re-executing the config graph on every keystroke.
  const source = readFileSync(path, 'utf8')

  let modVal: any
  const cached = moduleCache.get(path)
  if (cached) {
    modVal = cached.value
  }
  else {
    try {
      const mod = await import(path)
      modVal = mod?.default ?? mod
      moduleCache.set(path, { mtimeMs, value: modVal })
    }
    catch (err) {
      throw new Error(`Failed to load config/${name}.ts: ${(err as Error).message}`)
    }
  }

  // For previously-cached modules, refresh scalar fields from the source
  // text instead of re-importing — that way edits made via this API are
  // reflected immediately in subsequent reads without paying the import
  // re-evaluation cost (and without tripping Bun's URL cache).
  modVal = applySourceOverrides(modVal, source)
  const fields = describeFields(modVal, source)
  return { values: modVal, source, fields }
}

/**
 * Update a single top-level key in a config file. Returns the rewritten
 * source on success, or throws when the key is non-editable (nested,
 * env-backed, etc.) — caller should surface that to the UI.
 */
export interface UpdateResult {
  ok: boolean
  newValue: any
  source: string
}

export interface ConfigUpdate {
  key: string
  value: string | number | boolean
}

export interface BatchUpdateResult {
  ok: true
  updates: ConfigUpdate[]
  source: string
}

export async function updateConfigKey(
  name: string,
  key: string,
  newValue: string | number | boolean,
): Promise<UpdateResult> {
  const result = await updateConfigKeys(name, [{ key, value: newValue }])
  return { ok: true, newValue, source: result.source }
}

/**
 * Validate and apply a group of config edits as one filesystem operation.
 * Every rewrite is prepared in memory first, so one invalid field prevents
 * all fields from being persisted. The completed source is then swapped into
 * place with a same-directory rename.
 */
export async function updateConfigKeys(
  name: string,
  updates: ConfigUpdate[],
): Promise<BatchUpdateResult> {
  const path = join(configDir(), `${name}.ts`)
  if (!existsSync(path))
    throw new Error(`config/${name}.ts not found`)

  const source = readFileSync(path, 'utf8')
  const rewritten = rewriteConfigKeys(source, updates, `config/${name}.ts`)
  atomicWrite(path, rewritten)
  // We don't bust moduleCache here on purpose — re-importing with a
  // changed-on-disk file via Bun reuses the original module from the
  // first import; subsequent reads pick up the edit through the source-
  // text overlay (`applySourceOverrides`) instead.
  return { ok: true, updates, source: rewritten }
}

/**
 * Walk the source text for top-level scalar literal assignments and
 * overlay them onto the given values object. This lets us reflect
 * post-write edits without paying the cost (and risk) of re-importing
 * the whole config module after every keystroke.
 */
function applySourceOverrides(values: any, source: string): any {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return values
  const out: Record<string, any> = { ...values }
  for (const key of Object.keys(out)) {
    const re = scalarLiteralRegex(key)
    const m = re.exec(source)
    if (!m) continue
    const literal = m[4]
    const parsed = parseLiteral(literal)
    if (parsed !== UNSUPPORTED) out[key] = parsed
  }
  return out
}

const UNSUPPORTED = Symbol('unsupported')
function parseLiteral(literal: string): any {
  if (literal === 'true') return true
  if (literal === 'false') return false
  if (literal === 'null') return null
  if (/^-?\d+(?:\.\d+)?$/.test(literal)) return Number(literal)
  if ((literal.startsWith('\'') && literal.endsWith('\'')) || (literal.startsWith('"') && literal.endsWith('"'))) {
    return literal.slice(1, -1)
  }
  return UNSUPPORTED
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function titleCase(name: string): string {
  return name
    .split(/[-_]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

function describeFields(values: any, source: string): ConfigField[] {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return []
  const out: ConfigField[] = []
  for (const [key, value] of Object.entries(values)) {
    const type = typeOf(value)
    const editable = isScalar(type)
    let reason: string | undefined
    if (!editable) {
      reason = type === 'object' || type === 'array'
        ? 'Nested values can be edited by hand in the file'
        : 'Unsupported type'
    }
    else if (!hasScalarLiteral(source, key)) {
      // The source value is a non-literal expression like `env.FOO ?? 'x'`.
      // We can't safely rewrite it without losing the env fallback.
      // Mark as read-only and tell the user to set the env var instead.
      out.push({
        key,
        value,
        type,
        editable: false,
        reason: 'Defined via env var or expression. Set the environment variable to change it.',
      })
      continue
    }
    out.push({ key, value, type, editable, reason })
  }
  return out
}

function typeOf(v: any): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function isScalar(t: string): boolean {
  return t === 'string' || t === 'number' || t === 'boolean'
}

/**
 * Detects whether a top-level key in the export-default block is set
 * directly to a scalar literal — `key: 'value'`, `key: 42`, `key: true`.
 *
 * The match is intentionally conservative: it only succeeds when the
 * value following the colon is a single string/number/boolean literal,
 * optionally followed by a comma. Anything more complex
 * (`env.X ?? 'y'`, `[1, 2]`, `{ a: 1 }`, multi-line arrays, etc.)
 * fails so we don't accidentally clobber an expression.
 */
function hasScalarLiteral(source: string, key: string): boolean {
  const re = scalarLiteralRegex(key)
  return re.test(source)
}

function scalarLiteralRegex(key: string): RegExp {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Matches:
  //   <indent><key>: 'value' OR "value" OR 123 OR true/false/null
  // followed by optional comma + line-ending. The line MUST not contain
  // operators (??, ||, &&, +, ?), function calls, or sub-objects.
  return new RegExp(
    `^(\\s*)(${k})(\\s*:\\s*)('[^'\\n]*'|"[^"\\n]*"|-?\\d+(?:\\.\\d+)?|true|false|null)(\\s*,?\\s*)$`,
    'm',
  )
}

export function rewriteConfigKeys(
  source: string,
  updates: ConfigUpdate[],
  label = 'config source',
): string {
  if (updates.length === 0)
    throw new Error('No configuration updates supplied')

  const seen = new Set<string>()
  let rewritten = source
  for (const { key, value } of updates) {
    if (!key || seen.has(key))
      throw new Error(`Duplicate or empty configuration key "${key}"`)
    seen.add(key)

    const next = rewriteKey(rewritten, key, value)
    if (!next)
      throw new Error(`Cannot edit "${key}" in ${label}. The key is not a top-level scalar literal (likely env-backed or nested).`)
    rewritten = next
  }
  return rewritten
}

function rewriteKey(source: string, key: string, newValue: string | number | boolean): string | null {
  const re = scalarLiteralRegex(key)
  if (!re.test(source)) return null
  const literal = serializeScalar(newValue)
  return source.replace(re, (_full, indent, k, sep, _old, tail) => {
    return `${indent}${k}${sep}${literal}${tail}`
  })
}

function atomicWrite(path: string, source: string): void {
  const tempPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  try {
    const mode = statSync(path).mode
    writeFileSync(tempPath, source, { encoding: 'utf8', flag: 'wx', mode })
    chmodSync(tempPath, mode)
    renameSync(tempPath, path)
  }
  catch (error) {
    if (existsSync(tempPath))
      unlinkSync(tempPath)
    throw error
  }
}

function serializeScalar(v: string | number | boolean): string {
  if (typeof v === 'string') {
    // Prefer single quotes; fall back to double if the value contains a
    // bare apostrophe (avoid escape gymnastics).
    if (v.includes('\'') && !v.includes('"')) return `"${v}"`
    return `'${v.replace(/'/g, '\\\'')}'`
  }
  return String(v)
}
