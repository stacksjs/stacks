import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand('bun run build', {
  // ...options,
  cwd: frameworkPath('views/web'),
})
