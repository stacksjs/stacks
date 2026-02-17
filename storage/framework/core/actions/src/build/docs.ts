import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

await runCommand('bunpress build', {
  cwd: projectPath(),
})
