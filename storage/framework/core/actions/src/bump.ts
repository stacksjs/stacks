import { parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions()
const changelogCommand = options?.dryRun ? 'buddy changelog --quiet --dry-run' : 'buddy changelog --quiet'

await runCommand(changelogCommand, {
  cwd: p.projectPath(),
})

const bumpCommand = options?.dryRun
  ? 'bunx bumpp ./core/package.json ./core/**/package.json ./ide/vscode/package.json --no-push'
  : 'bunx bumpp ./core/package.json ./core/**/package.json ./ide/vscode/package.json --all'

await runCommand(bumpCommand, {
  cwd: p.frameworkPath('core'),
  stdin: 'inherit',
})
