import type { CLI } from '@stacksjs/types'
import { run as runArtifacts } from './docs/generated-artifacts'
import { run as runBuddyDocs } from './docs/buddy-commands'
import { run as runLinks } from './docs/links'
import { runTool } from './run-tool'

/**
 * Repo-scoped `buddy docs:*` commands wrapping the documentation-freshness
 * tooling under `app/Commands/docs/`: the generated buddy command reference,
 * generated API artifacts (OpenAPI + types), and internal link checking.
 */
export default function (cli: CLI): void {
  cli
    .command('docs:buddy', 'Regenerate the buddy command reference doc')
    .action(async () => {
      await runTool(runBuddyDocs, '--write')
    })

  cli
    .command('docs:buddy:check', 'Verify the buddy command reference doc is current')
    .action(async () => {
      await runTool(runBuddyDocs, '--check')
    })

  cli
    .command('docs:artifacts', 'Regenerate the generated API artifacts (OpenAPI + types)')
    .action(async () => {
      await runTool(runArtifacts, '--write')
    })

  cli
    .command('docs:artifacts:check', 'Verify the generated API artifacts are current')
    .action(async () => {
      await runTool(runArtifacts, '--check')
    })

  cli
    .command('docs:links', 'Report internal documentation links')
    .action(async () => {
      await runTool(runLinks)
    })

  cli
    .command('docs:links:check', 'Verify internal documentation links resolve')
    .action(async () => {
      await runTool(runLinks, '--check')
    })
}
