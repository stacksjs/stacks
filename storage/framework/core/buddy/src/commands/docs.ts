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
  buddy
    .command('docs:stories', 'Record browser and native user stories with video, scene screenshots and docs')
    .option('--config <path>', 'Story configuration path', { default: 'config/stories.ts' })
    .option('--out <directory>', 'Generated documentation and media directory')
    .option('--only <ids>', 'Comma-separated story ids')
    .option('--list', 'Validate and list stories without starting drivers', { default: false })
    .option('--check', 'Verify complete recordings, configuration and artifact hashes', { default: false })
    .option('--json', 'Print the story report as JSON', { default: false })
    .example('buddy docs:stories')
    .example('buddy docs:stories --only checkout-ios,checkout-android')
    .example('buddy docs:stories --check')
    .action(async (options: { config?: string, out?: string, only?: string, list?: boolean, check?: boolean, json?: boolean }) => {
      const { recordStories } = await import('@stacksjs/docs/stories')
      const report = await recordStories({ config: options.config, outDir: options.out, only: options.only?.split(',').map(value => value.trim()).filter(Boolean), list: options.list, check: options.check, onProgress: result => { if (!options.json) console.log(`${result.status} ${result.id} (${result.platform})`) } })
      if (options.json) console.log(JSON.stringify(report, null, 2))
      else if (options.list) for (const story of report.inventory) console.log(`${story.id} (${story.platform}): ${story.scenes.map(scene => scene.id).join(', ')}`)
      else console.log(`Story documentation: ${report.outDir}/index.md`)
      if (!options.list && report.results.some(result => result.status !== 'passed')) process.exitCode = 1
    })

  buddy
    .command('docs:screenshots', 'Capture and verify an explicit UI inventory with Bun WebView')
    .option('--config <path>', 'Screenshot configuration path', { default: 'config/screenshots.ts' })
    .option('--out <directory>', 'Override the output directory')
    .option('--only <ids>', 'Comma-separated screen ids to capture')
    .option('--viewport <names>', 'Comma-separated configured viewport names')
    .option('--list', 'Validate screen coverage without opening a browser', { default: false })
    .option('--check', 'Verify the complete saved inventory and image hashes', { default: false })
    .option('--publish', 'Rebuild the films and docs page from the saved captures, without a browser', { default: false })
    .option('--json', 'Print the inventory, model plan and capture report as JSON', { default: false })
    .example('buddy docs:screenshots --list')
    .example('buddy docs:screenshots --only welcome,calendar --viewport mobile')
    .action(async (options: { config?: string, out?: string, only?: string, viewport?: string, list?: boolean, check?: boolean, publish?: boolean, json?: boolean }) => {
      const { captureScreenshots, publishScreenshots } = await import('@stacksjs/docs/screenshots')
      if (options.publish) {
        const published = await publishScreenshots({ config: options.config, outDir: options.out })
        if (options.json) console.log(JSON.stringify(published, null, 2))
        else console.log(`${published.films?.length ?? 0} films${published.docsPage ? ` and ${published.docsPage.path}` : ''} rebuilt from ${published.results.filter(result => result.status === 'captured').length} captures.`)
        return
      }
      const report = await captureScreenshots({ config: options.config, outDir: options.out, only: options.only?.split(',').map(value => value.trim()).filter(Boolean), viewports: options.viewport?.split(',').map(value => value.trim()).filter(Boolean), list: options.list, check: options.check, onProgress: result => { if (!options.json) console.log(`${result.status} ${result.id}/${result.profile}/${result.viewport.name}`) } })
      if (options.json) {
        console.log(JSON.stringify(report, null, 2))
        if (report.results.some(result => result.status === 'failed')) process.exitCode = 1
        return
      }
      if (options.list) for (const screen of report.inventory) console.log(`${screen.id}  ${screen.path}${screen.skip ? `  [excluded: ${screen.skip}]` : ''}`)
      if (options.list) for (const model of report.models.models) console.log(`${model.name} (${model.table || 'table inferred'}, key ${model.primaryKey}): ${model.factoryFields.length} factories, seeder count ${model.seederCount ?? 'not declared'}, parents ${model.parents.join(', ') || 'none'}, required overrides ${model.requiredWithoutFactory.join(', ') || 'none'}, sensitive fields ${model.sensitiveFields.join(', ') || 'none'}, states ${model.suggestedStates.join(', ')}`)
      if (options.list && report.models.cycles.length) console.log(`Cyclic model dependencies: ${report.models.cycles.join(', ')}`)
      if (options.list && report.models.externalParents.length) console.log(`Parent fixtures outside this model set: ${report.models.externalParents.join(', ')}`)
      const failed = report.results.filter(result => result.status === 'failed')
      for (const result of failed) console.error(`${result.id}/${result.profile}/${result.viewport.name}: ${result.error}`)
      console.log(options.list ? 'Screenshot configuration and template coverage verified.' : `${report.results.filter(result => result.status === 'captured').length} captures, ${failed.length} failed, ${report.results.filter(result => result.status === 'skipped').length} explained exclusions.`)
      if (failed.length) process.exitCode = 1
    })

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
