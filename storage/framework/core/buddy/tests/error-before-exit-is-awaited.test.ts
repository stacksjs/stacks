/**
 * An error printed on the way out actually gets printed.
 *
 * `log.error` is async, and its first statement is `await getLogger()` - it
 * yields before anything reaches the terminal. So this shape:
 *
 *     log.error('Unknown AI provider: ...')
 *     process.exit(ExitCode.InvalidArgument)
 *
 * exits while the logger is still resolving and prints NOTHING. `buddy
 * setup:ai bogus` returned exit 9 in silence, and 215 call sites across the
 * CLI had the same shape (stacksjs/stacks#2056).
 *
 * Either await it, or - in a sync function that cannot - use `console.error`,
 * which writes before the process dies.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

/**
 * Sites where the message reaches the user by another route, so the
 * unawaited `log.error` is a redundant extra rather than the only output.
 */
const delivered = new Set<string>([
  // `reportFatal` writes the label and stack straight to `process.stderr`
  // immediately above this line, synchronously, before it ever calls the
  // logger - so the exit is not silent.
  'storage/framework/core/buddy/src/cli.ts:53',
])

function offenders(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!['dist', 'node_modules'].includes(entry))
        offenders(full, found)
      continue
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts'))
      continue

    const source = readFileSync(full, 'utf-8')

    /*
     * Some commands define their own `log` over `console.*` (deploy.ts,
     * server.ts). Those are synchronous, so they never race the exit and an
     * `await` on them would only imply an async contract they do not have.
     */
    if (/^\s*const log = \{/m.test(source))
      continue

    const lines = source.split('\n')
    lines.forEach((line, index) => {
      if (!/\blog\.error\(/.test(line) || line.includes('await'))
        return

      // Only the exit path matters. A fire-and-forget `log.error` that lets
      // the process keep running does flush on its own.
      const exitsImmediately = lines
        .slice(index + 1, index + 4)
        .some(next => next.includes('process.exit'))

      const site = `${full.replace(root, '')}:${index + 1}`
      if (exitsImmediately && !delivered.has(site))
        found.push(site)
    })
  }

  return found
}

describe('log.error before process.exit', () => {
  it('is awaited, so the message survives the exit', () => {
    const unawaited = [
      ...offenders(join(root, 'storage/framework/core')),
      ...offenders(join(root, 'storage/framework/defaults/app')),
    ]

    expect(unawaited.sort()).toEqual([])
  })
})
