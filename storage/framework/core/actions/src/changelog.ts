import { execSync, parseOptions, runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const fromRevision = await execSync('git describe --abbrev=0 --tags HEAD^')
const toRevision = await execSync('git describe')
const options = parseOptions()

const command = options?.dryRun ? `bunx changelogen --no-output --from ${fromRevision} --to ${toRevision}` : `bunx changelogen --output CHANGELOG.md --from ${fromRevision} --to ${toRevision}`
await runCommand(command, {
  cwd: projectPath(),
})
