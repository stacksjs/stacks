/**
 * The line protocol between the extension and dist/pickier-worker.js.
 *
 * Pickier runs on Bun (its config is a TypeScript file, and it uses Bun's glob
 * and YAML APIs), and VS Code runs extensions on Node, so the extension keeps
 * one Bun process per project and talks to it over stdin/stdout: one JSON
 * object per line each way, answers matched to requests by `id`.
 */

export type PickierOperation = 'lint' | 'fix' | 'format'

export interface PickierRequest {
  id: number
  op: PickierOperation
  /** Absolute path, for config ignores and the per-extension rules. */
  file: string
  text: string
}

/** One issue, as pickier's `lintText` reports it: 1-based line and column. */
export interface PickierIssue {
  line: number
  column: number
  ruleId: string
  message: string
  severity: 'error' | 'warning'
  help?: string
}

export type PickierResult =
  | { op: 'lint', issues: PickierIssue[] }
  /** `text` is null when the project's pickier predates `fixText`, or the file is ignored. */
  | { op: 'fix' | 'format', text: string | null }

export type PickierResponse =
  | { id: number, ok: true, result: PickierResult }
  | { id: number, ok: false, error: string, missing?: boolean }

/** The first line the worker writes, once it has loaded the project's pickier and config. */
export interface PickierReady {
  ready: true
  version: string
  fixText: boolean
}

/** What the worker writes instead when the project has no pickier it can load. */
export interface PickierUnavailable {
  ready: false
  error: string
  missing: boolean
}
