import type { CLI } from '@stacksjs/cli'
import { versionDescriptor } from './version-info'

interface GlobalOptionRegistration {
  /**
   * The upgrade command owns `-V, --version <version>` for its target release.
   * Do not register the process-wide version flag on that command or clapp's
   * global option will consume the value before the command can parse it.
   */
  version?: boolean
}

/**
 * Register Buddy's process-wide controls before any command modules load.
 *
 * `--dry-run` is deliberately NOT here. A global flag appears in every
 * command's `--help`, so Buddy advertised "Preview actions without making
 * changes" on all 346 commands while 30 implemented it. The rest accepted the
 * flag and did the live thing: `buddy setup --dry-run` migrated the database
 * (stacksjs/stacks#853), `buddy stripe:setup --dry-run` wrote real billing
 * objects (stacksjs/stacks#2359), and `buddy mail:provision --dry-run`
 * restarted a shared production mail server, minted DKIM keys and called ACME
 * (stacksjs/stacks#2865). Three commands had each grown their own guard
 * against the same root cause.
 *
 * Declared per command instead, so clapp's own unknown-option path refuses it
 * with a non-zero exit everywhere it is not implemented. A flag that silently
 * does nothing is worse than one that does not exist, because it is exactly
 * what a careful operator reaches for first.
 *
 * `--force` is not here either, for the same reason (stacksjs/stacks#2869).
 * It promised "Skip confirmation prompts" on every command, while the
 * commands that confirm skip it with `--yes`: `gdpr:erase --force` was
 * accepted, ignored, and then refused in a non-interactive shell. The 46
 * commands that implement `--force` declare it, each with what it means there.
 */
export function registerGlobalOptions(buddy: CLI, options: GlobalOptionRegistration = {}): void {
  const command = options.version === false
    ? buddy
    : buddy.version(versionDescriptor, '-V, --version')

  command
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('--debug', 'Enable debug output and stack traces')
    .option('--no-interaction', 'Do not ask interactive questions')
    .option('--env <environment>', 'Target an environment')
    .option('--no-emoji', 'Disable emoji in output')
    .option('--no-cache', 'Disable command metadata caching')
}
