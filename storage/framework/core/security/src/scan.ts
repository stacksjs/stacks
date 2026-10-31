/**
 * `@stacksjs/security/scan`: the project security scan behind
 * `buddy security:scan`. Kept off the package root because it reads the
 * filesystem and spawns git and bun, which the crypto helpers must not pull
 * into a browser bundle.
 */
export { scanCode, inlineIgnore } from './audit/code'
export { advisoryId, auditDependencies, parseBunAudit } from './audit/dependencies'
export { isDocPath, isScannable, isTestPath, projectFiles } from './audit/files'
export { failsScan, formatScan, severityCounts } from './audit/format'
export { plaintextSecrets, scanHygiene } from './audit/hygiene'
export { IGNORE_FILE, loadIgnores, matchingIgnore } from './audit/ignore'
export { runSecurityScan } from './audit/run'
export { entropy, redact, scanSecrets } from './audit/secrets'
export { atLeast, SCAN_CHECKS, SEVERITIES, severityRank } from './audit/types'
export type { Finding, IgnoreEntry, ScanCheck, ScanOptions, ScanReport, ScanSkip, Severity } from './audit/types'
export { scanWorkflow } from './audit/workflows'
