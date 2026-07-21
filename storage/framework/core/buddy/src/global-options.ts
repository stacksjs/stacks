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

/** Register Buddy's process-wide controls before any command modules load. */
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
    .option('--dry-run', 'Preview actions without making changes')
    .option('--force', 'Skip confirmation prompts')
    .option('--no-emoji', 'Disable emoji in output')
    .option('--no-cache', 'Disable command metadata caching')
}
