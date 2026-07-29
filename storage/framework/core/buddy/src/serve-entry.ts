/**
 * Dedicated production web-server entry.
 *
 * The regular Buddy CLI intentionally discovers and lazy-loads dozens of
 * commands. A production web process needs exactly one of them, so registering
 * only `serve` avoids loading the general-purpose command dispatcher and also
 * gives Bun a stable entrypoint it can bundle with `bun build --production`.
 */
import process from 'node:process'
import { cli } from '../../cli/src/cli'
import { serve } from './commands/serve'

process.env.APP_ENV ||= 'production'
process.env.NODE_ENV ||= 'production'

const buddy = cli('buddy')
serve(buddy)

// clapp reads process.argv. The dedicated entry has no user-facing subcommand,
// so inject `serve` while preserving any systemd-provided flags.
process.argv.splice(2, 0, 'serve')
await buddy.parse()
