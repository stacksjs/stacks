import { parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions()
const changelogCommand = options?.dryRun ? 'buddy changelog --quiet --dry-run' : 'buddy changelog --quiet'
const bumpCommand = options?.dryRun
  ? `bunx bumpp ./package.json ./**/package.json ../package.json ../ide/vscode/package.json ../cloud/package.json ../docs/package.json ../email/package.json ../orm/package.json ../system-tray/package.json ../ --no-push --execute "../scripts/lint"`
  : `bunx bumpp ./package.json ./**/package.json ../package.json ../ide/vscode/package.json ../cloud/package.json ../docs/package.json ../email/package.json ../orm/package.json ../system-tray/package.json ../ --all --execute "../scripts/lint"`

console.log(`Running: ${bumpCommand}`)
console.log(`In frameworkPath: ${p.frameworkPath()}`)

await runCommand(bumpCommand, {
  cwd: p.frameworkPath('core'),
  stdin: 'inherit',
})

await runCommand(changelogCommand, {
  cwd: p.projectPath(),
  stdin: 'inherit',
})
