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
      // Every level, not just `error`. A dropped `log.warn` is how a forced
      // worker shutdown came to report no reason at all.
      if (!/\blog\.(error|warn|warning|info|success)\(/.test(line) || line.includes('await'))
        return

      // `upgrade.ts` keeps a commented-out confirmation block whose lines match
      // this shape perfectly. Commented code cannot drop anything.
      const code = line.trimStart()
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*'))
        return

      // Only the exit path matters. A fire-and-forget `log.error` that lets
      // the process keep running does flush on its own.
      /*
       * Walk forward to the exit rather than peeking three lines, and stop at
       * anything that makes the write land: an `await` yields, and an explicit
       * `log.flush()` drains. Several commands print four or five lines before
       * exiting - `publish:*` printed the whole list of uncommitted files - and
       * a three-line window called those clean.
       */
      let exitsImmediately = false
      for (let ahead = index + 1; ahead < Math.min(index + 16, lines.length); ahead++) {
        const next = lines[ahead]!

        // Anything that makes the write land, or that means the exit is not
        // on this path at all. `setTimeout` was the one that mattered: both
        // queue workers log a signal, then arm a backstop that exits minutes
        // later, and counting that as "exits immediately" flagged three sites
        // whose logging is perfectly fine.
        if (next.includes('log.flush') || /\bawait\b/.test(next))
          break
        if (/\b(setTimeout|setInterval|queueMicrotask)\(/.test(next) || /=>\s*\{\s*$/.test(next))
          break
        if (/^\s*return\b/.test(next))
          break

        if (next.includes('process.exit')) {
          exitsImmediately = true
          break
        }
      }

      const site = `${full.replace(root, '')}:${index + 1}`
      if (exitsImmediately && !delivered.has(site))
        found.push(site)
    })
  }

  return found
}

describe('log.error before process.exit', () => {
  it('is awaited, so the message survives the exit', () => {
    /*
     * The app trees too, not just the framework. `app/Commands/Inspire.ts` had
     * exactly the bug that was fixed in the defaults copy - and since `app/`
     * overrides `storage/framework/defaults/app/`, the broken one was the copy
     * that actually ran.
     */
    const unawaited = [
      ...offenders(join(root, 'storage/framework/core')),
      ...offenders(join(root, 'storage/framework/defaults/app')),
      ...offenders(join(root, 'app')),
      ...offenders(join(root, 'routes')),
      ...offenders(join(root, 'config')),
    ]

    expect(unawaited.sort()).toEqual([])
  })
})
