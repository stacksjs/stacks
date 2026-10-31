export type Severity = 'critical' | 'high' | 'medium' | 'low'

/** Most severe first. */
export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low']

export type ScanCheck = 'dependencies' | 'secrets' | 'code' | 'workflows' | 'hygiene'

export const SCAN_CHECKS: readonly ScanCheck[] = ['dependencies', 'secrets', 'code', 'workflows', 'hygiene']

export interface Finding {
  /** `category/name`, e.g. `secret/aws-access-key`; what an ignore entry names. */
  rule: string
  check: ScanCheck
  severity: Severity
  title: string
  /** Project-relative path, when the finding is in a file. */
  file?: string
  line?: number
  /** What was found, with any secret redacted. */
  detail?: string
  fix?: string
  /** An advisory link or id (dependencies). */
  reference?: string
  /** The package an advisory is about (dependencies). */
  package?: string
}

/** A reviewed exception, kept in `.security-ignore.json` with its reason. */
export interface IgnoreEntry {
  rule: string
  /** A project-relative path, or a path ending in `/` for a directory; omit for every file. */
  path?: string
  /** For a dependency advisory: its id (`GHSA-...`) or `package@range`. */
  reference?: string
  reason: string
  /** `YYYY-MM-DD`: after this day the exception stops applying, so it is looked at again. */
  expires?: string
}

export interface ScanOptions {
  /** The project root. Defaults to the current directory. */
  cwd?: string
  /** Run only these checks. */
  only?: readonly ScanCheck[]
  /** Skip these checks. */
  skip?: readonly ScanCheck[]
  /** Do not call the network (the dependency audit). */
  offline?: boolean
  /** Today, `YYYY-MM-DD`, for expiring exceptions. */
  today?: string
}

export interface ScanSkip {
  check: ScanCheck
  reason: string
}

export interface ScanReport {
  cwd: string
  /** The checks that ran. */
  checks: ScanCheck[]
  /** Checks that could not run (offline, no `bun audit`), with why. Never silent. */
  skipped: ScanSkip[]
  filesScanned: number
  findings: Finding[]
  /** Findings an ignore entry or an inline `security-ignore` comment set aside. */
  ignored: Array<Finding & { reason: string }>
  /** Problems with the ignore file itself (no reason, expired). */
  ignoreProblems: string[]
  durationMs: number
}

export function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity)
}

/** Whether `severity` is at least as severe as `threshold`. */
export function atLeast(severity: Severity, threshold: Severity): boolean {
  return severityRank(severity) <= severityRank(threshold)
}
