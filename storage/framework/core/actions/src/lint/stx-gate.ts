/**
 * stx conformance checks, run by `buddy lint --stx`.
 *
 * Chapter 12 of the stx standards, plus three that read the build output. Those
 * three exist because a real bug shipped past every source-level check: a
 * mis-resolved component put an error string where the sidebar should have been
 * on every built page, so the app shipped with no navigation and the
 * developer's home directory in the HTML - and the build still exited 0. No
 * amount of reading `.stx` files catches that; only reading `dist/` does.
 *
 * Configured from `config/lint.ts` like every other Stacks subsystem. Counts
 * are compared against the baselines declared there: going ABOVE one is a
 * regression, and dropping BELOW one without lowering it is also reported,
 * because a ratchet that only ever loosens is theatre.
 *
 * Pure. Returns a report and never exits or writes; the command renders it and
 * owns the exit code.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { Glob } from 'bun'

export interface StxLintConfig {
  /** Templates to check, relative to the project root. */
  stxGlob: string
  /** Built HTML to check, relative to the project root. */
  distGlob: string
  /** Accepted count per check id. A number here is a debt, not a target. */
  baselines: Record<string, number>
  /** Path prefixes exempt from the `<!DOCTYPE>` rule. */
  doctypeExempt: string[]
  /**
   * Path prefixes exempt from the styling and link rules.
   *
   * Email templates by default, and not as a concession: an email client
   * strips `<style>` and has no router, so inline `style=""` and absolute
   * `<a href>` are the only things that work there. Counting them would make
   * the number permanently un-clearable.
   */
  styleExempt: string[]
  /**
   * Strict-lint rules to switch off, by rule id.
   *
   * For rules that are stale against the installed stx and produce false
   * positives. Say which version you verified against - an entry here silences
   * a real finding just as easily as a false one.
   */
  staleRules: Record<string, boolean>
}

export interface StxLintResult {
  id: string
  label: string
  /** Why this is not zero yet, and what clears it. Absent when the target is 0. */
  why?: string
  count: number
  baseline: number
  detail: string[]
  status: 'pass' | 'fail' | 'loosened'
}

export interface StxLintReport {
  root: string
  results: StxLintResult[]
  /** No build output was found, so the dist checks did not really run. */
  distMissing: boolean
  failed: number
  loosened: number
  /** Current counts, for printing a copy-pasteable baseline block. */
  counts: Record<string, number>
}

export const DEFAULT_STX_LINT_CONFIG: StxLintConfig = {
  stxGlob: 'resources/**/*.stx',
  distGlob: 'dist/**/*.html',
  baselines: {},
  doctypeExempt: [],
  styleExempt: ['resources/emails/'],
  staleRules: {},
}

/**
 * stx config keys the checks require, because a missing one silently disables a
 * check rather than failing it. Reported as an ordinary check so a project that
 * cannot set them today records the count and ratchets it down: pinning
 * `root`/`pagesDir` changes how stx resolves topology, which is not a change a
 * linter should make on a project's behalf.
 */
const REQUIRED_STX_CONFIG_KEYS: Array<[key: string, why: string]> = [
  ['strict', 'DOM guard (ch. 12.1) - without it script-validation discards every finding'],
  ['root', 'pins project topology; absent, resolveStxRoot sniffs it and double-prefixes dirs'],
  ['pagesDir', 'must accompany root - resolveStxRoot falls back to a non-existent "pages"'],
]

/** Read `config/lint.ts`, falling back to defaults when a project has none. */
export async function loadStxLintConfig(root: string): Promise<StxLintConfig> {
  const candidates = ['config/lint.ts', 'config/lint.js']
  const found = candidates.find(c => existsSync(join(root, c)))
  if (!found)
    return { ...DEFAULT_STX_LINT_CONFIG }

  try {
    const mod = await import(join(root, found)) as { default?: { stx?: Partial<StxLintConfig> } }
    const stx = mod.default?.stx ?? {}
    return {
      ...DEFAULT_STX_LINT_CONFIG,
      ...stx,
      baselines: { ...stx.baselines },
      // A project naming its own exemptions replaces the default rather than
      // appending, so one with no email templates can drop the entry.
      styleExempt: stx.styleExempt ?? DEFAULT_STX_LINT_CONFIG.styleExempt,
      doctypeExempt: stx.doctypeExempt ?? [],
      staleRules: stx.staleRules ?? {},
    }
  }
  catch (error) {
    throw new Error(`Could not read ${found}: ${(error as Error).message}`)
  }
}

async function scanGlob(pattern: string, root: string): Promise<string[]> {
  const out: string[] = []
  try {
    for await (const f of new Glob(pattern).scan(root)) out.push(f)
  }
  catch {
    // A missing directory is legitimate (no dist/ before a build); the
    // dependent checks report 0 and the caller notes it.
  }
  return out.sort()
}

/**
 * Anchors that have already declared what they are.
 *
 * `data-stx-link` hands the anchor to the router, which is exactly what rule 9
 * asks for; `data-no-router` is a deliberate full page load. Flagging either
 * fires on the fix as loudly as on the problem, and a check that cannot be
 * satisfied gets its baseline raised instead of cleared.
 */
const ROUTED_ANCHOR = /\bdata-stx-link\b|\bdata-no-router\b/

async function grepLines(re: RegExp, files: string[], root: string, ignore?: RegExp): Promise<string[]> {
  const hits: string[] = []
  for (const f of files) {
    let src = ''
    try { src = await Bun.file(join(root, f)).text() }
    catch { continue }
    src.split('\n').forEach((line, i) => {
      re.lastIndex = 0
      if (!re.test(line)) return
      if (ignore) {
        ignore.lastIndex = 0
        if (ignore.test(line)) return
      }
      hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
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
 * One pass over every template, for the checks that need the body parsed rather
 * than grepped. Done together because each would otherwise re-read and re-parse
 * the same sources.
 */
async function scanSources(files: string[], root: string, config: StxLintConfig): Promise<SourceScan> {
  const { lintStxStrict } = await import('@stacksjs/stx')
  const { PROHIBITED_DOM_PATTERNS } = await import('@stacksjs/stx/script-validation')
  const { scanScriptTags } = await import('@stacksjs/stx/signal-processing')

  // The installed stx types leave the element type unresolved; the shape is
  // stable and asserted once here rather than widened at every use.
  const domPatterns = PROHIBITED_DOM_PATTERNS as ReadonlyArray<{ pattern: RegExp, message: string, suggestion: string }>
  const scan: SourceScan = { domGuard: [], strictLint: [], balance: [], commentLandmine: [], doctype: [] }

  for (const f of files) {
    let src = ''
    try { src = await Bun.file(join(root, f)).text() }
    catch { continue }

    for (const d of lintStxStrict(src, { filePath: f, rules: config.staleRules }) ?? [])
      scan.strictLint.push(`${f}:${d.line}:${d.column}  ${d.ruleId}  ${d.message}`)

    for (const s of scanScriptTags(src, { skipAttrs: /\bserver\b|\bsrc\s*=/ })) {
      for (const { pattern, message, suggestion } of domPatterns) {
        pattern.lastIndex = 0
        const m = s.body.match(pattern)
        if (m) scan.domGuard.push(`${f}  ${message} x${m.length} -> ${suggestion}`)
      }
    }

    // An unbalanced count means a literal "</script" sits inside a script body,
    // which truncates the block there and silently drops the rest.
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

    const exempt = config.doctypeExempt.some(p => f.startsWith(p) || f === p)
    if (/<!DOCTYPE\s/i.test(src) && !/@nolayout\b/.test(src) && !exempt)
      scan.doctype.push(`${f}  <!DOCTYPE> with no @nolayout - layout resolution is silently skipped`)
  }

  return scan
}

/** Missing stx config keys, each of which silently disables a check. */
async function missingStxConfigKeys(root: string): Promise<string[]> {
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
    // passing quietly here beats a confusing second error.
    return []
  }

  return REQUIRED_STX_CONFIG_KEYS
    .filter(([key]) => ui[key] == null)
    .map(([key, why]) => `${found} is missing "${key}" - ${why}`)
}

/**
 * Run every check and report.
 *
 * `status` is `fail` when a count sits above its baseline, `loosened` when it
 * sits below one (real progress, but the baseline is now stale), `pass` when
 * they match.
 */
export async function runStxLint(options: { root?: string, config?: StxLintConfig } = {}): Promise<StxLintReport> {
  const root = options.root ?? process.cwd()
  const config = options.config ?? await loadStxLintConfig(root)

  const stxAll = await scanGlob(config.stxGlob, root)
  const dist = await scanGlob(config.distGlob, root)
  const styled = stxAll.filter(f => !config.styleExempt.some(p => f.startsWith(p)))
  const scan = await scanSources(stxAll, root, config)
  const configErrors = await missingStxConfigKeys(root)

  const definitions: Array<{ id: string, label: string, why?: string, detail: () => Promise<string[]> | string[] }> = [
    {
      id: 'stx-config-keys',
      label: 'stx config sets every key the standards require',
      why: 'pinning root/pagesDir changes topology resolution, so it is a deliberate move',
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
      label: 'no unrouted internal <a href="/"> (rule 9 - use StxLink)',
      why: 'converting marketing pages is usually its own pass',
      detail: () => grepLines(/<a [^>]*href="\//, styled, root, ROUTED_ANCHOR),
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

  const results: StxLintResult[] = []
  for (const def of definitions) {
    const detail = await def.detail()
    const count = detail.length
    // Anything the project has not named is held at zero. A check added by a
    // framework upgrade therefore starts strict rather than silently
    // inheriting whatever the project happens to have.
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
    distMissing: dist.length === 0,
    failed: results.filter(r => r.status === 'fail').length,
    loosened: results.filter(r => r.status === 'loosened').length,
    counts: Object.fromEntries(results.map(r => [r.id, r.count])),
  }
}
