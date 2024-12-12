import { execSync, log, parseOptions, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

// when log.debug is used, only log to file in production
log.debug('Generating changelog')
const fromRevision = await execSync('git describe --abbrev=0 --tags HEAD^')
log.debug('FromRevision', fromRevision)
const toRevision = await execSync('git describe')
log.debug('ToRevision', toRevision)
const options = parseOptions()
log.debug('Changelog Options', options)

const command = options?.dryRun
  ? `bunx --bun changelogen --no-output --from ${fromRevision} --to ${toRevision}`
  : `bunx --bun changelogen --output CHANGELOG.md --from ${fromRevision} --to ${toRevision}`

await runCommand(command, {
  cwd: projectPath(),
  quiet: options?.quiet,
  verbose: options?.verbose,
})
