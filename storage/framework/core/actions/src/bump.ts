import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions()
const changelogCommand = options?.dryRun ? 'buddy changelog --quiet --dry-run' : 'buddy changelog --quiet'
const bumpCommand = options?.dryRun
  ? `bunx bumpp ./package.json ./**/package.json ../package.json ../ide/vscode/package.json ../views/** ../cloud/package.json ../server/package.json ../orm/package.json ../docs/package.json ../api/package.json ../email/package.json ../system-tray/package.json --no-push --execute "../scripts/lint"`
  : `bunx bumpp ./package.json ./**/package.json ../package.json ../ide/vscode/package.json ../views/** ../cloud/package.json ../server/package.json ../orm/package.json ../docs/package.json ../api/package.json ../email/package.json ../system-tray/package.json --all --execute "../scripts/lint"`

log.debug(`Running: ${bumpCommand}`)
log.debug(`In frameworkPath: ${p.frameworkPath()}`)

await runCommand(bumpCommand, {
  cwd: p.frameworkPath('core'),
  stdin: 'inherit',
})

await runCommand(changelogCommand, {
  cwd: p.projectPath(),
  stdin: 'inherit',
})
