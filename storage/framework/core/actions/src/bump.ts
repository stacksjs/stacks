import { log, parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions()
const changelogCommand = options?.dryRun
  ? 'buddy changelog --quiet --dry-run'
  : 'buddy changelog --quiet'

const bumpCommand = options?.dryRun
  ? `bunx --bun bumpp ./package.json ./**/package.json ../package.json ../defaults/ide/vscode/package.json ../views/** ../cloud/package.json ../server/package.json ../orm/package.json ../docs/package.json ../api/package.json ../email/package.json ../libs/**/package.json ../system-tray/package.json --no-push`
  : `bunx --bun bumpp ./package.json ./**/package.json ../package.json ../defaults/ide/vscode/package.json ../views/** ../cloud/package.json ../server/package.json ../orm/package.json ../docs/package.json ../api/package.json ../email/package.json ../libs/**/package.json ../system-tray/package.json --all`

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
