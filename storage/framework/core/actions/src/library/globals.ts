import { existsSync } from 'node:fs'
import { projectPath } from '@stacksjs/path'

/**
 * The identifiers stx injects into an STX page entry.
 *
 * They are ambient — `stx.d.ts` declares them, the runtime provides them, and
 * NO module exports them. That is fine inside an app and fatal inside a
 * published package: `export const count = state(0)` compiles cleanly and
 * throws `ReferenceError: state is not defined` the first time a consumer
 * imports it. Reading the declarations rather than hardcoding a list means
 * this tracks whatever stx version is installed.
 */
export async function stxAmbientGlobals(): Promise<Set<string>> {
  const candidates = [
    projectPath('node_modules/@stacksjs/stx/stx.d.ts'),
    projectPath('storage/framework/core/stx/stx.d.ts'),
  ]

  const file = candidates.find(candidate => existsSync(candidate))

  // No declarations to read means no check to run. A missing optional file
  // must never be the reason a build fails.
  if (!file)
    return new Set()

  const source = await Bun.file(file).text()
  const names = new Set<string>()

  for (const match of source.matchAll(/^declare (?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm))
    names.add(match[1] as string)

  return names
}

/**
 * Which ambient globals a source file leans on.
 *
 * Deliberately conservative: a name is only reported when the file neither
 * imports nor declares it, and property accesses (`foo.state`), object keys
 * and string contents are skipped, so the check does not invent work for an
 * author whose file happens to contain the word.
 */
export function ambientGlobalsUsed(source: string, globals: Set<string>): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""')

  const used = new Set<string>()

  for (const match of stripped.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*(?=[([<.,;)\]}=+\-*/?:]|$)/gm)) {
    const name = match[2] as string

    if (globals.has(name))
      used.add(name)
  }

  if (!used.size)
    return []

  for (const name of [...used]) {
    const declared = new RegExp(`(?:^|[^.\\w$])(?:const|let|var|function|class)\\s+${name}\\b`, 'm').test(stripped)
    const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, 'm').test(stripped)

    if (declared || imported)
      used.delete(name)
  }

  return [...used].sort()
}
