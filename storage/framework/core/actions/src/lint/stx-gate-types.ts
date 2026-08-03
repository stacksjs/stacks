/**
 * Types for the stx conformance gate.
 *
 * Split from the implementation so `buddy lint:stx` can type its rendering
 * without importing the module that pulls in `@stacksjs/stx`.
 */

export interface StxGateConfig {
  /** Glob of source templates to check, relative to the project root. */
  stxGlob: string
  /** Glob of built HTML, relative to the project root. */
  distGlob: string
  /** Accepted count per check id. A number here is a debt, not a target. */
  baselines: Record<string, number>
  /** Path prefixes exempt from the `<!DOCTYPE>` rule. */
  doctypeExempt: string[]
  /** Path prefixes exempt from the styling and link rules (email templates). */
  styleExempt: string[]
  /**
   * Strict-lint rules to switch off, by rule id.
   *
   * For rules that are STALE against the installed stx and produce false
   * positives. Verify against the installed version before adding one, and say
   * which version you verified against - an entry here silences a real finding
   * just as easily as a false one.
   */
  staleRules: Record<string, boolean>
}

export interface StxGateResult {
  id: string
  label: string
  /** Why this is not zero yet, and what clears it. Absent when the target is 0. */
  why?: string
  count: number
  baseline: number
  detail: string[]
  status: 'pass' | 'fail' | 'loosened'
}

export interface StxGateReport {
  root: string
  results: StxGateResult[]
  /** No build output was found, so the dist checks did not really run. */
  distMissing: boolean
  failed: number
  loosened: number
  /** Current counts, for `--update` to write back as the new baselines. */
  nextBaselines: Record<string, number>
}
