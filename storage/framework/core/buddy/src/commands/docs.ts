import type { CLI } from '@stacksjs/types'
import { run as runAgentCounts } from './docs/agent-counts'
import { run as runArtifacts } from './docs/generated-artifacts'
import { run as runBuddyDocs } from './docs/buddy-commands'
import { run as runLinks } from './docs/links'
import { runTool } from './run-tool'

/**
 * Framework-repo `buddy docs:*` commands wrapping the documentation-freshness
 * tooling under `commands/docs/`: the generated buddy command reference,
 * generated API artifacts (OpenAPI + types), and internal link checking.
 */
export function docs(buddy: CLI): void {
  buddy
    .command('docs:buddy', 'Regenerate the buddy command reference doc')
    .action(async () => {
      await runTool(runBuddyDocs, '--write')
    })

  buddy
    .command('docs:buddy:check', 'Verify the buddy command reference doc is current')
    .action(async () => {
      await runTool(runBuddyDocs, '--check')
    })

  buddy
    .command('docs:artifacts', 'Regenerate the generated API artifacts (OpenAPI + types)')
    .action(async () => {
      await runTool(runArtifacts, '--write')
    })

  buddy
    .command('docs:artifacts:check', 'Verify the generated API artifacts are current')
    .action(async () => {
      await runTool(runArtifacts, '--check')
    })

  buddy
    .command('docs:agent-counts', 'Rewrite the counts AGENTS.md and the skills state, from the tree')
    .action(async () => {
      await runTool(runAgentCounts, '--write')
    })

  buddy
    .command('docs:agent-counts:check', 'Verify the counts AGENTS.md and the skills state are current')
    .action(async () => {
      await runTool(runAgentCounts, '--check')
    })

  buddy
    .command('docs:links', 'Report internal documentation links')
    .action(async () => {
      await runTool(runLinks)
    })

  buddy
    .command('docs:links:check', 'Verify internal documentation links resolve')
    .action(async () => {
      await runTool(runLinks, '--check')
    })
}
