/**
 * Dashboard `.stx` conventions guardrail (stacksjs/stacks#1838).
 *
 * The migration to "stores for state, composables for DOM, no
 * `<script server>`" is a multi-PR sweep, not a single change. This
 * test acts as a *ratchet*: it locks in the *current* set of offending
 * files so new pages can't introduce regressions, and signals when a
 * known offender finally gets fixed so the allowlist can shrink.
 *
 * If you fixed a file and a test here fails saying "file X is no
 * longer in the offender list — remove it from the allowlist," that's
 * the intended behaviour. Update the corresponding array below.
 *
 * If you added a NEW file and a test fails saying "file Y is a new
 * offender," fix the file or — only when there's a deliberate, documented
 * reason — add it to the allowlist with an explanation. The whole point
 * of this test is to make ad-hoc additions visible.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DASHBOARD_ROOT = join(import.meta.dir, '../../../defaults/views/dashboard')

function walkStxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...walkStxFiles(full))
    }
    else if (entry.endsWith('.stx')) {
      out.push(full)
    }
  }
  return out
}

function relPath(absolute: string): string {
  return absolute.slice(DASHBOARD_ROOT.length + 1)
}

/**
 * `<script server>` tag detector that ignores comments and prose.
 * Requires the tag at column-0 after optional whitespace, which is how
 * stx authors actually write it (the tag opens at the top of a line).
 */
function hasServerScriptTag(src: string): boolean {
  return /^\s*<script\s+server[\s>]/m.test(src)
}

/**
 * `window.X` / `document.X` detector that ignores single-line comments
 * and JSDoc-style block comment lines. Avoids false positives like
 * `// no window. or document. allowed` in instructional comments.
 *
 * Heuristic, not a full JS parser: for each non-empty line, drop any
 * trailing `// …` segment, then check the remainder. Block-comment
 * tracking adds enough robustness for the dashboard's actual file
 * shapes without needing AST work.
 */
function hasLiveDomAccess(src: string): boolean {
  const tokenRe = /\b(?:window|document)\./
  let inBlockComment = false
  for (const rawLine of src.split('\n')) {
    let line = rawLine
    if (inBlockComment) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      line = line.slice(end + 2)
      inBlockComment = false
    }
    // Strip block comments fully contained on this line, and flip the
    // `inBlockComment` flag for any unterminated open.
    while (true) {
      const open = line.indexOf('/*')
      if (open === -1) break
      const close = line.indexOf('*/', open + 2)
      if (close === -1) {
        line = line.slice(0, open)
        inBlockComment = true
        break
      }
      line = line.slice(0, open) + line.slice(close + 2)
    }
    // Strip trailing `// …` comments. Naive (doesn't handle `//` inside
    // strings) but sufficient — dashboard files don't embed `//` inside
    // string literals around DOM access calls.
    const lineCommentIdx = line.indexOf('//')
    if (lineCommentIdx !== -1)
      line = line.slice(0, lineCommentIdx)
    // Skip JSDoc / leading-` * ` lines outright.
    if (/^\s*\*/.test(line)) continue
    if (tokenRe.test(line)) return true
  }
  return false
}

/**
 * Files allowed to contain `<script server>`. Pages on this list are
 * scheduled for conversion to `<script client>` + store/composable
 * access. Each removal here is forward progress on #1838.
 *
 * Generated 2026-05-20 from a full sweep — every file currently
 * containing the pattern is listed. Adding to this list should be a
 * deliberate decision (reviewer flag).
 */
const SERVER_SCRIPT_ALLOWLIST: ReadonlySet<string> = new Set<string>([])

/**
 * Files allowed to contain `window.` or `document.` references. Most
 * remaining cases are pre-existing vanilla `<script>` blocks under
 * `content/*` and `commerce/*` doing manual event wiring — converting
 * them is the next sweep target.
 *
 * The layout file is exempted intentionally: it installs the
 * `<script type="importmap">` shim + role-filter at the document level,
 * which is what a layout *should* do.
 */
const DOM_ACCESS_ALLOWLIST: ReadonlySet<string> = new Set([
  'cloud/index.stx',
  'commerce/pos/index.stx',
  'content/authors/index.stx',
  'content/categories/index.stx',
  'content/comments/index.stx',
  'content/pages/index.stx',
  'content/posts/index.stx',
  'content/tags/index.stx',
  'environment/index.stx',
  'jobs/[id].stx',
  'kanban/[id].stx',
  'layouts/default.stx',
  'queries/[id].stx',
  'requests/index.stx',
  'servers/index.stx',
  'serverless/index.stx',
])

describe('dashboard .stx conventions (stacksjs/stacks#1838)', () => {
  const files = walkStxFiles(DASHBOARD_ROOT)

  test('audit can enumerate at least 50 dashboard .stx files', () => {
    // Cheap sanity check — if this regresses the test harness has the
    // wrong path or the dashboard moved.
    expect(files.length).toBeGreaterThanOrEqual(50)
  })

  test('no NEW file introduces a <script server> block', () => {
    const offenders: string[] = []
    for (const file of files) {
      if (!hasServerScriptTag(readFileSync(file, 'utf8'))) continue
      const rel = relPath(file)
      if (!SERVER_SCRIPT_ALLOWLIST.has(rel)) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  test('no NEW file introduces window./document. access', () => {
    const offenders: string[] = []
    for (const file of files) {
      if (!hasLiveDomAccess(readFileSync(file, 'utf8'))) continue
      const rel = relPath(file)
      if (!DOM_ACCESS_ALLOWLIST.has(rel)) offenders.push(rel)
    }
    expect(offenders).toEqual([])
  })

  test('every allowlisted server-script file still has a <script server> block', () => {
    // Catches the inverse drift: a file got fixed but nobody trimmed
    // the allowlist. Each removal here is forward progress.
    const stale: string[] = []
    for (const rel of SERVER_SCRIPT_ALLOWLIST) {
      const abs = join(DASHBOARD_ROOT, rel)
      try {
        const src = readFileSync(abs, 'utf8')
        if (!hasServerScriptTag(src)) stale.push(rel)
      }
      catch {
        // File was deleted entirely — list it so the allowlist gets trimmed.
        stale.push(`${rel} (file missing)`)
      }
    }
    expect(stale).toEqual([])
  })

  test('every allowlisted DOM-access file still references window./document.', () => {
    const stale: string[] = []
    for (const rel of DOM_ACCESS_ALLOWLIST) {
      const abs = join(DASHBOARD_ROOT, rel)
      try {
        const src = readFileSync(abs, 'utf8')
        if (!hasLiveDomAccess(src)) stale.push(rel)
      }
      catch {
        stale.push(`${rel} (file missing)`)
      }
    }
    expect(stale).toEqual([])
  })
})
