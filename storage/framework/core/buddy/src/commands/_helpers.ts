import type { CLI } from '@stacksjs/types'
import process from 'node:process'

/**
 * Wire the standard "unknown subcommand" handler for a command group.
 *
 * Every buddy command file used to repeat this 5-line pattern:
 *
 * ```ts
 * buddy.on('foo:*', () => {
 *   console.error('Invalid command: %s\nSee --help for ...', buddy.args.join(' '))
 *   process.exit(1)
 * })
 * ```
 *
 * Centralizing it here:
 *   1. Removes ~43 copies of the same boilerplate
 *   2. Makes the message format consistent (and easy to update)
 *   3. Routes through a shared exit code so test harnesses can
 *      distinguish "user typed an unknown subcommand" from real
 *      errors without scraping stderr
 *
 * @example
 * ```ts
 * import { onUnknownSubcommand } from './_helpers'
 *
 * onUnknownSubcommand(buddy, 'queue')
 * ```
 */
export function onUnknownSubcommand(buddy: CLI, prefix: string): void {
  buddy.on(`${prefix}:*`, () => {
    // @stacksjs/clapp exposes `args` at runtime but the public CLI type doesn't
    // surface it. Widening through `unknown` is the canonical "I know
    // better than the type system here" escape hatch and only runs in
    // the error-path so the cost is irrelevant.
    const args = (buddy as unknown as { args?: string[] }).args ?? []
    process.stderr.write(
      `Unknown ${prefix} subcommand: ${args.join(' ')}\n`
      + `Run \`buddy ${prefix} --help\` to see available subcommands.\n`,
    )
    // Exit 64 = EX_USAGE per <sysexits.h>. Distinct from 1 (general
    // failure) so CI / shell scripts can branch on "user-error" vs
    // "real failure" without parsing stderr.
    process.exit(64)
  })
}
