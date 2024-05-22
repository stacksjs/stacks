import { parseOptions, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

const options = parseOptions()
const changelogCommand = options?.dryRun ? 'buddy changelog --quiet --dry-run' : 'buddy changelog --quiet'

// await runCommand(changelogCommand, {
//   cwd: p.projectPath(),
// })

const bumpCommand = options?.dryRun
  ? `bunx bumpp ./package.json ./**/package.json ../ide/vscode/package.json --no-push --execute "../scripts/generate-changelog-and-lint"`
  : `bunx bumpp ./package.json ./**/package.json ../ide/vscode/package.json --all --execute "../scripts/generate-changelog-and-lint"`

console.log(`Running: ${bumpCommand}`)
console.log(`In frameworkPath: ${p.frameworkPath()}`)

await runCommand(bumpCommand, {
  cwd: p.frameworkPath('core'),
  stdin: 'inherit',
})
