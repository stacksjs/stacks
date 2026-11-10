import type { CLI } from '@stacksjs/types'
import { run as runAgentCounts } from './docs/agent-counts'
import { run as runArtifacts } from './docs/generated-artifacts'
import { run as runBuddyDocs } from './docs/buddy-commands'
import { run as runCapabilities } from './docs/capabilities'
import { run as runSnippets } from './docs/snippets'
import { run as runDesktopMatrix } from './docs/desktop-matrix'
import { run as runLinks } from './docs/links'
import { run as runNativeSkills } from './docs/native-skills'
import { runTool } from './run-tool'

/**
 * Application style guides and framework documentation freshness tooling.
 * The style guide commands run in any app; commands under `commands/docs/`
 * validate the framework repository's own reference artifacts.
 */
export function docs(buddy: CLI): void {
  for (const check of [false, true]) {
    buddy
      .command(check ? 'docs:style-guide:check' : 'docs:style-guide', check ? 'Verify generated application style guide freshness' : 'Generate a branded application component style guide')
      .option('--config <path>', 'Style guide configuration path', { default: 'config/style-guide.ts' })
      .action(async (options: { config?: string }) => {
        const { runStyleGuide } = await import('@stacksjs/docs/style-guide')
        const result = await runStyleGuide({ config: options.config, check })
        console.log(`${check ? 'Verified' : 'Generated'} style guide: ${result!.components} components, ${result!.stories} stories, ${result!.variants} variants.`)
      })
  }

  buddy
    .command('docs:native-skills', 'Regenerate native skill package coverage and driver evidence')
    .action(async () => {
      await runTool(runNativeSkills, '--write')
    })

  buddy
    .command('docs:native-skills:check', 'Verify native skills cover current packages and driver capabilities')
    .action(async () => {
      await runTool(runNativeSkills, '--check')
    })

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
    .command('docs:capabilities', 'Regenerate the driver capability matrix in docs/features/capabilities.md')
    .action(async () => {
      await runTool(runCapabilities, '--write')
    })

  buddy
    .command('docs:capabilities:check', 'Verify the published capability matrix matches its registry')
    .action(async () => {
      await runTool(runCapabilities, '--check')
    })

  buddy
    .command('docs:desktop-matrix', 'Regenerate the desktop support matrix in docs/packages/desktop.md')
    .action(async () => {
      await runTool(runDesktopMatrix, '--write')
    })

  buddy
    .command('docs:desktop-matrix:check', 'Verify the published desktop support matrix matches its source')
    .action(async () => {
      await runTool(runDesktopMatrix, '--check')
    })

  buddy
    .command('docs:snippets', 'Record the documented imports that do not compile, as the baseline')
    .action(async () => {
      await runTool(runSnippets, '--write')
    })

  buddy
    .command('docs:snippets:check', 'Verify no NEW documented import fails to compile')
    .action(async () => {
      await runTool(runSnippets, '--check')
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
