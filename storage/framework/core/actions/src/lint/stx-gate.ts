/**
 * stx conformance gate.
 *
 * Chapter 12 of the stx standards, plus three build-output checks. The last
 * three exist because a real bug shipped past every other gate in a downstream
 * app: a mis-resolved component put an error string where the sidebar should
 * have been on every built page, so the app shipped with no navigation and the
 * developer's home directory in the HTML - and the build still exited 0. Source
 * checks cannot see that. Only reading `dist/` can.
 *
 * RATCHET, NOT A CLIFF. Most projects cannot hold every count at zero on day
 * one, and a gate that demands it just gets switched off. Each check carries a
 * baseline: the gate fails if a count goes ABOVE it, and also fails if a count
 * drops BELOW it without the baseline being lowered. The second half is the
 * important one - a ratchet that only ever loosens is theatre.
 *
 * Baselines live in `.stx-gate.json` at the project root, which `--update`
 * rewrites. Keeping them in a data file rather than in this source means an app
 * records its own debt without forking the gate, and the diff that clears a
 * violation is the same diff that lowers the number.
 *
 * This module is pure: it returns results and never exits. `buddy lint:stx`
 * renders them and owns the exit code.
 */

import type { StxGateConfig, StxGateReport, StxGateResult } from './stx-gate-types'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Glob } from 'bun'

export const STX_GATE_CONFIG_FILE = '.stx-gate.json'

/**
 * stx config keys the gate requires, because a missing one silently disables a
 * check rather than failing it.
 */
const REQUIRED_CONFIG_KEYS: Array<[key: string, why: string]> = [
  ['strict', 'DOM guard (ch. 12.1) - without it script-validation discards every finding'],
  ['root', 'pins project topology; absent, resolveStxRoot sniffs it and double-prefixes dirs'],
  ['pagesDir', 'must accompany root - resolveStxRoot falls back to a non-existent "pages"'],
]

/**
 * Email templates are exempt from the styling and link rules, and it is not a
 * concession: an email client strips `<style>` and has no router, so inline
 * `style=""` and absolute `<a href>` are the only things that work there.
 * Counting them as debt would make the number permanently un-clearable.
 */
const DEFAULT_STYLE_EXEMPT = ['resources/emails/']

export const DEFAULT_STX_GATE_CONFIG: StxGateConfig = {
  stxGlob: 'resources/**/*.stx',
  distGlob: 'dist/**/*.html',
  baselines: {},
  doctypeExempt: [],
  styleExempt: DEFAULT_STYLE_EXEMPT,
  staleRules: {},
}

/** Read `.stx-gate.json`, falling back to defaults when the project has none. */
export async function loadStxGateConfig(root: string): Promise<StxGateConfig> {
  const file = join(root, STX_GATE_CONFIG_FILE)
  if (!existsSync(file))
    return { ...DEFAULT_STX_GATE_CONFIG }

  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<StxGateConfig>
    return {
      ...DEFAULT_STX_GATE_CONFIG,
      ...parsed,
      baselines: { ...parsed.baselines },
      // A project that names its own style exemptions replaces the default
      // rather than appending to it, so `resources/emails/` can be dropped by a
      // project that does not have one.
      styleExempt: parsed.styleExempt ?? DEFAULT_STYLE_EXEMPT,
      doctypeExempt: parsed.doctypeExempt ?? [],
      staleRules: parsed.staleRules ?? {},
    }
  }
  catch (error) {
    throw new Error(`Could not read ${STX_GATE_CONFIG_FILE}: ${(error as Error).message}`)
  }
}

/** Write the baselines back, preserving every other key the project set. */
export async function writeStxGateBaselines(root: string, baselines: Record<string, number>): Promise<void> {
  const file = join(root, STX_GATE_CONFIG_FILE)
  let existing: Record<string, unknown> = {}
  if (existsSync(file)) {
    try { existing = JSON.parse(await readFile(file, 'utf8')) }
    catch { existing = {} }
  }
  const sorted = Object.fromEntries(Object.entries(baselines).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(file, `${JSON.stringify({ ...existing, baselines: sorted }, null, 2)}\n`, 'utf8')
}

async function scanGlob(pattern: string, root: string): Promise<string[]> {
  const out: string[] = []
  try {
    for await (const f of new Glob(pattern).scan(root)) out.push(f)
  }
  catch {
    // A missing directory is a legitimate state (no dist/ before a build); the
    // dependent checks report 0 and the caller prints a note.
  }
  return out.sort()
}

async function grepLines(re: RegExp, files: string[], root: string): Promise<string[]> {
  const hits: string[] = []
  for (const f of files) {
    let src = ''
    try { src = await Bun.file(join(root, f)).text() }
    catch { continue }
    src.split('\n').forEach((line, i) => {
      re.lastIndex = 0
      if (re.test(line)) hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
    })
  }
  return hits
}

interface SourceScan {
  domGuard: string[]
  strictLint: string[]
  balance: string[]
  commentLandmine: string[]
  doctype: string[]
}

/**
 * One pass over every `.stx` file, collecting the checks that need the file
 * body parsed rather than grepped. Done together because each of these would
 * otherwise re-read and re-parse the same sources.
 */
async function scanSources(files: string[], root: string, config: StxGateConfig): Promise<SourceScan> {
  const { lintStxStrict } = await import('@stacksjs/stx')
  const { PROHIBITED_DOM_PATTERNS } = await import('@stacksjs/stx/script-validation')
  const { scanScriptTags } = await import('@stacksjs/stx/signal-processing')

  const scan: SourceScan = { domGuard: [], strictLint: [], balance: [], commentLandmine: [], doctype: [] }

  for (const f of files) {
    let src = ''
    try { src = await Bun.file(join(root, f)).text() }
    catch { continue }

    for (const d of lintStxStrict(src, { filePath: f, rules: config.staleRules }) ?? [])
      scan.strictLint.push(`${f}:${d.line}:${d.column}  ${d.ruleId}  ${d.message}`)

    // The installed stx types leave PROHIBITED_DOM_PATTERNS' element type
    // unresolved; the shape is stable and asserted here rather than widened at
    // every use site.
    const domPatterns = PROHIBITED_DOM_PATTERNS as ReadonlyArray<{ pattern: RegExp, message: string, suggestion: string }>

    for (const s of scanScriptTags(src, { skipAttrs: /\bserver\b|\bsrc\s*=/ })) {
      for (const { pattern, message, suggestion } of domPatterns) {
        pattern.lastIndex = 0
        const m = s.body.match(pattern)
        if (m) scan.domGuard.push(`${f}  ${message} x${m.length} -> ${suggestion}`)
      }
    }

    // An unbalanced count means a literal "</script" sits inside a script body,
    // which truncates the block at that point and silently drops the rest.
    const open = (src.match(/<script\b/gi) ?? []).length
    const close = (src.match(/<\/script\s*>/gi) ?? []).length
    if (open !== close)
      scan.balance.push(`${f}  ${open} <script> vs ${close} </script> - a "</script" sits inside a script body`)

    // stx parses a tag name inside an HTML comment as an element, which breaks
    // OUT of the comment. The closing marker is then never emitted and the
    // browser swallows the rest of the document as comment content.
    for (const m of src.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (/<\/?html\b|<!DOCTYPE\b|<\/?script\b/i.test(m[1] ?? '')) {
        const line = src.slice(0, m.index).split('\n').length
        scan.commentLandmine.push(`${f}:${line}  banned token inside <!-- -->`)
      }
    }

    const doctypeExempt = config.doctypeExempt.some(p => f.startsWith(p) || f === p)
    if (/<!DOCTYPE\s/i.test(src) && !/@nolayout\b/.test(src) && !doctypeExempt)
      scan.doctype.push(`${f}  <!DOCTYPE> with no @nolayout - layout resolution is silently skipped`)
  }

  return scan
}

/**
 * Read the project's stx config surface, so a missing key fails loudly.
 *
 * Reported as an ordinary check rather than a special case, so a project that
 * cannot set these today records the count and ratchets it down like any other
 * debt. Pinning `root`/`pagesDir` changes how stx resolves topology, which is
 * not a change any tool should make on a project's behalf.
 */
async function missingConfigKeys(root: string): Promise<string[]> {
  const candidates = ['config/ui.ts', 'config/ui.js']
  const found = candidates.find(c => existsSync(join(root, c)))
  if (!found)
    return []

  let ui: Record<string, unknown>
  try {
    ui = ((await import(join(root, found))) as { default?: Record<string, unknown> }).default ?? {}
  }
  catch {
    // An unreadable config is its own problem and other tooling reports it;
    // silently passing here beats a confusing second error.
    return []
  }

  return REQUIRED_CONFIG_KEYS
    .filter(([key]) => ui[key] == null)
    .map(([key, why]) => `${found} is missing "${key}" - ${why}`)
}

/**
 * Run every gate and report. Never exits, never writes unless asked.
 *
 * `status` per check is one of:
 *   - `pass`      count equals the baseline
 *   - `fail`      count is ABOVE the baseline - a regression
 *   - `loosened`  count is BELOW the baseline - real progress, but the baseline
 *                 is now stale and must be lowered or the ratchet stops holding
 */
export async function runStxGate(options: {
  root?: string
  config?: StxGateConfig
} = {}): Promise<StxGateReport> {
  const root = options.root ?? process.cwd()
  const config = options.config ?? await loadStxGateConfig(root)

  const stxAll = await scanGlob(config.stxGlob, root)
  const dist = await scanGlob(config.distGlob, root)
  const styled = stxAll.filter(f => !config.styleExempt.some(p => f.startsWith(p)))
  const scan = await scanSources(stxAll, root, config)
  const configErrors = await missingConfigKeys(root)

  const definitions: Array<{
    id: string
    label: string
    why?: string
    detail: () => Promise<string[]> | string[]
  }> = [
    {
      id: 'stx-config-keys',
      label: 'stx config sets every key the standards require',
      why: 'pinning root/pagesDir changes topology resolution, so it is a deliberate move, not a sweep',
      detail: () => configErrors,
    },
    { id: 'style-block', label: 'no <style> block in a .stx file (rule 11.1)', detail: () => grepLines(/<style/, stxAll, root) },
    { id: 'doctype-no-nolayout', label: 'no <!DOCTYPE> outside the exempt list (rule 2.2)', detail: () => scan.doctype },
    { id: 'script-tag-balance', label: 'no "</script" inside a script body', detail: () => scan.balance },
    { id: 'comment-landmine', label: 'no html/DOCTYPE/script token inside an HTML comment', detail: () => scan.commentLandmine },
    { id: 'strict-lint', label: 'stx\'s own strict linter', detail: () => scan.strictLint },
    {
      id: 'dom-guard',
      label: 'prohibited DOM access in client scripts',
      why: 'imperative views clear these as they move to signals',
      detail: () => scan.domGuard,
    },
    {
      id: 'inline-style-attr',
      label: 'no style="" attribute (rule 11.5)',
      why: 'pre-hydration display:none; the sanctioned form is a :class with literal branches',
      detail: () => grepLines(/style="/, styled, root),
    },
    {
      id: 'plain-internal-anchor',
      label: 'no plain internal <a href="/"> (rule 9 - use StxLink)',
      why: 'converting marketing pages is usually its own pass',
      detail: () => grepLines(/<a [^>]*href="\//, styled, root),
    },
    {
      id: 'unmanaged-timer',
      label: 'no bare setTimeout/setInterval (rule 6.7)',
      why: 'useTimeout()/useDebounce() unsubscribe on destroy; bare timers outlive the SPA swap',
      detail: () => grepLines(/(^|[^.\w])(setTimeout|setInterval)\s*\(/, stxAll, root),
    },
    { id: 'dist-component-error', label: 'no unresolved component in built HTML', detail: () => grepLines(/Error loading component/, dist, root) },
    { id: 'dist-path-leak', label: 'no absolute filesystem path in built HTML', detail: () => grepLines(/\/(Users|home)\/[a-z]/i, dist, root) },
    { id: 'dist-layout-published', label: 'no layout emitted as a public page', detail: () => dist.filter(f => f.startsWith('layouts/') || f.includes('/layouts/')) },
  ]

  const results: StxGateResult[] = []
  for (const def of definitions) {
    const detail = await def.detail()
    const count = detail.length
    // Anything not named in the project's baselines is held at zero. That is
    // the safe default: a new check added by a framework upgrade starts strict
    // rather than silently inheriting whatever the project happens to have.
    const baseline = config.baselines[def.id] ?? 0
    results.push({
      id: def.id,
      label: def.label,
      why: def.why,
      count,
      baseline,
      detail,
      status: count > baseline ? 'fail' : count < baseline ? 'loosened' : 'pass',
    })
  }

  return {
    root,
    results,
    /** True when no build output was found, so the dist checks did not really run. */
    distMissing: dist.length === 0,
    failed: results.filter(r => r.status === 'fail').length,
    loosened: results.filter(r => r.status === 'loosened').length,
    nextBaselines: Object.fromEntries(results.map(r => [r.id, r.count])),
  }
}
