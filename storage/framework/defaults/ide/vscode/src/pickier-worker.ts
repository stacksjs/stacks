/**
 * The Bun side of the extension's pickier support (bundled to
 * dist/pickier-worker.js, started with the project root as its working
 * directory). See ./pickier-protocol.ts.
 *
 * It loads the PROJECT's pickier, not a copy bundled into the extension, and
 * lets pickier find the project's config itself, the way `./buddy lint` does
 * (core/actions/src/lint/lint.ts). Editor and command therefore agree on the
 * rules, the version and the ignores.
 */
import type { PickierReady, PickierRequest, PickierResponse, PickierResult, PickierUnavailable } from './pickier-protocol'
import { relative } from 'node:path'
import process from 'node:process'

interface PickierModule {
  lintText: (text: string, config: unknown, filePath?: string) => Promise<Array<{ line: number, column: number, ruleId: string, message: string, severity: 'error' | 'warning', help?: string }>>
  formatCode: (text: string, config: unknown, filePath: string) => string
  fixText?: (text: string, config: unknown, filePath?: string) => string
  loadConfigFromPath: (path: string | undefined) => Promise<{ ignores?: string[] }>
  shouldIgnorePath?: (absPath: string, ignoreGlobs: string[]) => boolean
}

function send(message: PickierResponse | PickierReady | PickierUnavailable): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

const root = process.cwd()
let pickier: PickierModule
let config: { ignores?: string[] }
let version = 'unknown'

try {
  const entry = Bun.resolveSync('pickier', root)
  pickier = await import(entry) as PickierModule
  try {
    version = (await import(Bun.resolveSync('pickier/package.json', root))).version ?? version
  }
  catch {}
  config = await pickier.loadConfigFromPath(undefined)
}
catch (error) {
  // Not a pickier project (or not installed yet): say so and stop, so the
  // extension stops asking instead of retrying on every keystroke.
  send({ ready: false, error: String(error), missing: true })
  process.exit(0)
}

send({ ready: true, version, fixText: typeof pickier.fixText === 'function' })

function ignored(file: string): boolean {
  const rel = relative(root, file)
  if (rel.startsWith('..'))
    return true
  return pickier.shouldIgnorePath?.(file, config.ignores ?? []) ?? false
}

async function handle(request: PickierRequest): Promise<PickierResult> {
  if (request.op === 'lint') {
    if (ignored(request.file))
      return { op: 'lint', issues: [] }
    const issues = await pickier.lintText(request.text, config, request.file)
    return { op: 'lint', issues: issues.map(({ line, column, ruleId, message, severity, help }) => ({ line, column, ruleId, message, severity, help })) }
  }

  if (ignored(request.file))
    return { op: request.op, text: null }

  if (request.op === 'fix')
    return { op: 'fix', text: pickier.fixText ? pickier.fixText(request.text, config, request.file) : null }

  return { op: 'format', text: pickier.formatCode(request.text, config, request.file) }
}

for await (const line of console) {
  if (!line.trim())
    continue

  let request: PickierRequest
  try {
    request = JSON.parse(line)
  }
  catch {
    continue
  }

  try {
    send({ id: request.id, ok: true, result: await handle(request) })
  }
  catch (error) {
    send({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
