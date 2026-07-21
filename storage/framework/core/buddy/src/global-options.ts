import type { CLI } from '@stacksjs/cli'
import { versionDescriptor } from './version-info'

/** Register Buddy's process-wide controls before any command modules load. */
export function registerGlobalOptions(buddy: CLI): void {
  buddy
    .version(versionDescriptor, '-V, --version')
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
