import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

await runCommand('buddy changelog --quiet', {
  cwd: p.projectPath(),
})

await runCommand(
  'bunx bumpp ./package.json ./core/**/package.json ./ide/vscode/package.json --all',
  { cwd: p.frameworkPath(), stdin: 'inherit' },
)
