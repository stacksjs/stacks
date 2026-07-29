/**
 * Dedicated production web-server entry.
 *
 * The regular Buddy CLI intentionally discovers and lazy-loads dozens of
 * commands. A production web process needs exactly one action, so calling the
 * server API directly avoids retaining any command parser and gives Bun a
 * stable entrypoint it can bundle with `bun build --production`.
 */
import process from 'node:process'
import { startProductionServer } from './commands/serve'

process.env.APP_ENV ||= 'production'
process.env.NODE_ENV ||= 'production'

await startProductionServer()
