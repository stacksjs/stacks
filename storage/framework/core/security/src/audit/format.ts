import type { Finding, ScanReport, Severity } from './types'
import { atLeast, SEVERITIES } from './types'

const COLOR: Record<Severity, string> = { critical: '\x1B[1;31m', high: '\x1B[31m', medium: '\x1B[33m', low: '\x1B[2m' }
const RESET = '\x1B[0m'
const DIM = '\x1B[2m'
const BOLD = '\x1B[1m'
const GREEN = '\x1B[32m'

export interface FormatOptions {
  color?: boolean
  /** Also list what exceptions set aside. */
  showIgnored?: boolean
}

/** Whether the report has a finding at or above `threshold` (the exit code), or a broken exception file. */
export function failsScan(report: ScanReport, threshold: Severity | 'none'): boolean {
  if (threshold === 'none') return false
  return report.findings.some(finding => atLeast(finding.severity, threshold)) || report.ignoreProblems.length > 0
}

export function severityCounts(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const finding of findings) counts[finding.severity]++
  return counts
}

/** The report as terminal text. */
export function formatScan(report: ScanReport, options: FormatOptions = {}): string {
  const paint = (text: string, code: string) => options.color ? `${code}${text}${RESET}` : text
  const out: string[] = []
  for (const severity of SEVERITIES) {
    const group = report.findings.filter(finding => finding.severity === severity)
    if (!group.length) continue
    out.push('', paint(`${severity.toUpperCase()} (${group.length})`, COLOR[severity]))
    for (const finding of group) {
      const where = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : finding.package ?? ''
      out.push(`  ${paint(finding.rule, BOLD)}  ${finding.title}`)
      if (where) out.push(`    ${where}`)
      if (finding.detail) out.push(`    ${paint(finding.detail, DIM)}`)
      if (finding.reference) out.push(`    ${paint(finding.reference, DIM)}`)
      if (finding.fix) out.push(`    ${paint(`Fix: ${finding.fix}`, DIM)}`)
    }
  }
  if (options.showIgnored && report.ignored.length) {
    out.push('', paint(`SET ASIDE (${report.ignored.length})`, DIM))
    for (const finding of report.ignored) out.push(`  ${finding.rule}  ${finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : finding.package ?? ''}  ${paint(`(${finding.reason})`, DIM)}`)
  }
  for (const problem of report.ignoreProblems) out.push('', paint(`! ${problem}`, COLOR.high))
  for (const skip of report.skipped) out.push('', paint(`- ${skip.check} not checked: ${skip.reason}`, DIM))
  const counts = severityCounts(report.findings)
  const total = report.findings.length
  out.push('')
  if (!total && !report.ignoreProblems.length) {
    out.push(paint(`No security findings.`, GREEN) + paint(` ${report.checks.join(', ')}; ${report.filesScanned} files${report.ignored.length ? `; ${report.ignored.length} set aside with a reason` : ''}; ${(report.durationMs / 1000).toFixed(1)}s`, DIM))
  }
  else {
    out.push(`${total} finding${total === 1 ? '' : 's'}: ${SEVERITIES.map(severity => `${counts[severity]} ${severity}`).join(', ')}` + paint(`; ${report.filesScanned} files${report.ignored.length ? `; ${report.ignored.length} set aside` : ''}; ${(report.durationMs / 1000).toFixed(1)}s`, DIM))
  }
  return out.join('\n').replace(/^\n/, '')
}
