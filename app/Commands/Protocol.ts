import type { CLI } from '@stacksjs/types'
import { run as runConformance } from './protocol/run-conformance'
import { run as runCraft } from './protocol/craft-evidence'
import { run as runDesktop } from './protocol/desktop-support'
import { run as runDrivers } from './protocol/driver-registry'
import { run as runDriverContracts } from './protocol/run-driver-contracts'
import { run as runPantry } from './protocol/pantry-evidence'
import { run as runRelease } from './protocol/release-manifest'
import { run as runManifest } from './protocol/source-manifest'
import { run as runSync } from './protocol/sync-suite'
import { runTool } from './run-tool'

/**
 * Repo-scoped `buddy protocol:*` commands. The governance tooling itself lives
 * beside this file under `app/Commands/protocol/`; the protocol suite + evidence
 * DATA stays under `.github/protocol/`. These wrap the tooling so it is
 * discoverable via the CLI (`buddy protocol:conformance`) instead of a bare
 * `bun app/Commands/protocol/...`.
 */
export default function (cli: CLI): void {
  cli
    .command('protocol:conformance', 'Generate the Stacks protocol conformance report')
    .action(async () => {
      await runConformance()
    })

  cli
    .command('protocol:sync', 'Sync the vendored protocol suite from stacksjs/rfcs')
    .option('--source <path>', 'Path to a local rfcs checkout', { default: undefined })
    .action(async (options: { source?: string }) => {
      await runTool(runSync, '--write', ...(options.source ? ['--source', options.source] : []))
    })

  cli
    .command('protocol:check', 'Verify the vendored protocol suite is pinned + internally consistent')
    .action(async () => {
      await runTool(runSync, '--check')
    })

  cli
    .command('protocol:manifest', 'Write the protocol source manifest')
    .option('--revision <ref>', 'Source revision to pin (default HEAD)', { default: undefined })
    .action(async (options: { revision?: string }) => {
      await runTool(runManifest, '--write', ...(options.revision ? ['--revision', options.revision] : []))
    })

  cli
    .command('protocol:manifest:check', 'Verify the protocol source manifest is current')
    .action(async () => {
      await runTool(runManifest, '--check')
    })

  cli
    .command('protocol:release', 'Write the protocol release manifest')
    .option('--tag <tag>', 'Release tag', { default: undefined })
    .action(async (options: { tag?: string }) => {
      await runTool(runRelease, '--write', ...(options.tag ? ['--tag', options.tag] : []))
    })

  cli
    .command('protocol:release:check', 'Verify the protocol release manifest is current')
    .action(async () => {
      await runTool(runRelease, '--check')
    })

  cli
    .command('protocol:drivers', 'Write the driver capability registry evidence')
    .action(async () => {
      await runTool(runDrivers, '--write')
    })

  cli
    .command('protocol:drivers:check', 'Verify the driver capability registry evidence')
    .action(async () => {
      await runTool(runDrivers, '--check')
    })

  cli
    .command('protocol:drivers:test', 'Run the driver contract suite')
    .action(async () => {
      await runTool(runDriverContracts)
    })

  cli
    .command('protocol:desktop', 'Write the desktop support matrix evidence')
    .action(async () => {
      await runTool(runDesktop, '--write')
    })

  cli
    .command('protocol:desktop:check', 'Verify the desktop support matrix evidence')
    .action(async () => {
      await runTool(runDesktop, '--check')
    })

  cli
    .command('protocol:pantry', 'Write the pantry evidence')
    .action(async () => {
      await runTool(runPantry, '--write')
    })

  cli
    .command('protocol:pantry:check', 'Verify the pantry evidence')
    .action(async () => {
      await runTool(runPantry, '--check')
    })

  cli
    .command('protocol:craft', 'Write the Craft evidence')
    .action(async () => {
      await runTool(runCraft, '--write')
    })

  cli
    .command('protocol:craft:check', 'Verify the Craft evidence')
    .action(async () => {
      await runTool(runCraft, '--check')
    })
}
