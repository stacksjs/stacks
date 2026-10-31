import type { Finding, ScanSkip, Severity } from './types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

interface BunAdvisory {
  id?: number
  url?: string
  title?: string
  severity?: string
  vulnerable_versions?: string
  cwe?: string[]
  cvss?: { score?: number }
}

const SEVERITY: Record<string, Severity> = { critical: 'critical', high: 'high', moderate: 'medium', medium: 'medium', low: 'low' }

/** `https://github.com/advisories/GHSA-xxxx-xxxx-xxxx` → `GHSA-xxxx-xxxx-xxxx`. */
export function advisoryId(url: string | undefined): string | undefined {
  return url?.match(/GHSA-[\w-]+/i)?.[0] ?? url
}

/** Turn `bun audit --json` output into findings. Pure. */
export function parseBunAudit(json: string): Finding[] | null {
  let data: unknown
  try { data = JSON.parse(json) }
  catch { return null }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const findings: Finding[] = []
  for (const [name, advisories] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(advisories)) continue
    for (const advisory of advisories as BunAdvisory[]) {
      const severity = SEVERITY[String(advisory.severity ?? '').toLowerCase()] ?? 'medium'
      const range = advisory.vulnerable_versions ? ` (${advisory.vulnerable_versions})` : ''
      findings.push({
        rule: 'dependency/advisory',
        check: 'dependencies',
        severity,
        title: advisory.title || `Known vulnerability in ${name}`,
        package: name,
        detail: `${name}${range}${advisory.cvss?.score ? `, CVSS ${advisory.cvss.score}` : ''}`,
        reference: advisoryId(advisory.url),
        fix: `Raise ${name} outside ${advisory.vulnerable_versions || 'the affected range'}: update the package that depends on it (bun update ${name} --recursive) so the lockfile resolves a fixed version. Do not pin it with overrides.`,
      })
    }
  }
  const rank = (severity: Severity) => ['critical', 'high', 'medium', 'low'].indexOf(severity)
  return findings.sort((a, b) => rank(a.severity) - rank(b.severity) || (a.package ?? '').localeCompare(b.package ?? ''))
}

/**
 * Known vulnerabilities in the installed dependencies, from the registry's
 * advisory database through `bun audit`. Returns the reason instead when it
 * cannot run, so a scan never reports "clean" for a check that did not happen.
 */
export async function auditDependencies(cwd: string, timeoutMs = 60_000): Promise<{ findings: Finding[] } | { skipped: ScanSkip }> {
  const skipped = (reason: string) => ({ skipped: { check: 'dependencies' as const, reason } })
  if (!existsSync(join(cwd, 'bun.lock')) && !existsSync(join(cwd, 'bun.lockb'))) return skipped('no bun.lock to audit')
  try {
    const proc = Bun.spawn([process.execPath, 'audit', '--json'], { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, NO_COLOR: '1' } })
    const timer = setTimeout(() => proc.kill(), timeoutMs)
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
    clearTimeout(timer)
    // `bun audit` exits 1 when it finds something, with the JSON on stdout.
    const findings = parseBunAudit(stdout.trim() || '{}')
    if (findings) return { findings }
    const why = (stderr || stdout).trim().split('\n').find(line => line.trim()) ?? `exited ${code}`
    return skipped(`bun audit gave no report (${why.slice(0, 160)})`)
  }
  catch (error) {
    return skipped(`bun audit could not run (${error instanceof Error ? error.message : String(error)})`)
  }
}
