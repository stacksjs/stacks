import type { Finding, ScanCheck, ScanOptions, ScanReport, ScanSkip } from './types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { scanCode, inlineIgnore } from './code'
import { auditDependencies } from './dependencies'
import { isScannable, MAX_FILE_BYTES, projectFiles } from './files'
import { scanHygiene } from './hygiene'
import { loadIgnores, matchingIgnore } from './ignore'
import { scanSecrets } from './secrets'
import { SCAN_CHECKS } from './types'
import { scanWorkflow } from './workflows'

const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$|(^|\/)action\.ya?ml$/

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function trackedFiles(cwd: string): Promise<string[] | null> {
  try {
    const proc = Bun.spawn(['git', 'ls-files', '-z', '--cached'], { cwd, stdout: 'pipe', stderr: 'ignore' })
    const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
    return code === 0 ? text.split('\0').filter(Boolean) : null
  }
  catch { return null }
}

/** Read up to `limit` files at a time; a file that cannot be read is skipped, not fatal. */
async function eachFile(cwd: string, files: readonly string[], visit: (path: string, text: string) => void, limit = 48): Promise<number> {
  let read = 0
  let next = 0
  async function worker(): Promise<void> {
    while (next < files.length) {
      const path = files[next++]!
      if (!isScannable(path)) continue
      try {
        const file = Bun.file(join(cwd, path))
        if (file.size > MAX_FILE_BYTES || file.size === 0) continue
        const text = await file.text()
        if (text.slice(0, 4096).includes('\0')) continue
        read++
        visit(path, text)
      }
      catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(files.length, 1)) }, worker))
  return read
}

/**
 * Scan a project for security problems. Checks:
 *
 * - `dependencies`: known vulnerabilities in the lockfile (`bun audit`)
 * - `secrets`: credentials committed to files
 * - `code`: calls that are dangerous when fed variable data (eval, shell
 *   strings, SQL interpolation, disabled TLS checks, ...)
 * - `workflows`: GitHub Actions that run untrusted text or code with secrets
 * - `hygiene`: committed `.env` files and key material, `.gitignore`
 *
 * Findings an exception in `.security-ignore.json` (with a reason, optionally
 * an expiry) or a `security-ignore` comment sets aside are returned as
 * `ignored`, never dropped silently. A check that cannot run (offline, no
 * `bun audit`) is reported in `skipped`.
 */
export async function runSecurityScan(options: ScanOptions = {}): Promise<ScanReport> {
  const started = Date.now()
  const cwd = options.cwd ?? process.cwd()
  const day = options.today ?? today()
  const only = options.only?.length ? options.only : SCAN_CHECKS
  const checks = SCAN_CHECKS.filter(check => only.includes(check) && !options.skip?.includes(check))
  const skipped: ScanSkip[] = []
  const found: Finding[] = []
  const ignored: ScanReport['ignored'] = []
  const ignoreProblems: string[] = []
  const { entries, problems } = await loadIgnores(cwd, day)
  ignoreProblems.push(...problems)

  const settle = (finding: Finding, lines?: readonly string[]) => {
    const inline = lines && finding.line ? inlineIgnore(lines, finding.line - 1) : null
    if (inline && (!inline.rule || inline.rule === finding.rule || (inline.rule.endsWith('/*') && finding.rule.startsWith(inline.rule.slice(0, -1))))) {
      if (inline.reason.length >= 8) return void ignored.push({ ...finding, reason: inline.reason })
      ignoreProblems.push(`${finding.file}:${finding.line} has a security-ignore comment without a reason, so ${finding.rule} still counts`)
    }
    const entry = matchingIgnore(finding, entries)
    if (entry) return void ignored.push({ ...finding, reason: entry.reason })
    found.push(finding)
  }

  const wantsFiles = checks.some(check => check === 'secrets' || check === 'code' || check === 'workflows')
  let filesScanned = 0
  const jobs: Array<Promise<void>> = []

  if (wantsFiles) {
    jobs.push((async () => {
      const { files } = await projectFiles(cwd)
      const withSecrets = checks.includes('secrets')
      const withCode = checks.includes('code')
      const withWorkflows = checks.includes('workflows')
      filesScanned = await eachFile(cwd, files, (path, text) => {
        const lines = text.split('\n')
        if (withSecrets) for (const finding of scanSecrets(path, text)) settle(finding, lines)
        if (withCode) for (const finding of scanCode(path, text)) settle(finding, lines)
        if (withWorkflows && WORKFLOW_FILE.test(path)) for (const finding of scanWorkflow(path, text)) settle(finding, lines)
      })
    })())
  }

  if (checks.includes('hygiene')) {
    jobs.push((async () => {
      const tracked = await trackedFiles(cwd)
      if (!tracked) return void skipped.push({ check: 'hygiene', reason: 'not a git checkout' })
      const gitignore = await readFile(join(cwd, '.gitignore'), 'utf8').catch(() => null)
      const envs: Record<string, string> = {}
      await Promise.all(tracked.filter(path => /(^|\/)\.env(\.[\w.-]+)?$/.test(path)).map(async (path) => {
        const text = await readFile(join(cwd, path), 'utf8').catch(() => null)
        if (text !== null) envs[path] = text
      }))
      for (const finding of scanHygiene(tracked, gitignore, existsSync(join(cwd, 'package.json')), envs)) settle(finding)
    })())
  }

  if (checks.includes('dependencies')) {
    if (options.offline) skipped.push({ check: 'dependencies', reason: 'offline: the advisory database needs the network' })
    else {
      jobs.push((async () => {
        const result = await auditDependencies(cwd)
        if ('skipped' in result) skipped.push(result.skipped)
        else for (const finding of result.findings) settle(finding)
      })())
    }
  }

  await Promise.all(jobs)
  const rank = ['critical', 'high', 'medium', 'low']
  const byWhere = (a: Finding, b: Finding) => rank.indexOf(a.severity) - rank.indexOf(b.severity) || (a.file ?? a.package ?? '').localeCompare(b.file ?? b.package ?? '') || (a.line ?? 0) - (b.line ?? 0) || a.rule.localeCompare(b.rule)
  return {
    cwd,
    checks: checks as ScanCheck[],
    skipped: skipped.sort((a, b) => a.check.localeCompare(b.check)),
    filesScanned,
    findings: found.sort(byWhere),
    ignored: ignored.sort(byWhere),
    ignoreProblems,
    durationMs: Date.now() - started,
  }
}
