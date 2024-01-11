import { runCommand } from '@stacksjs/cli'
import { corePath } from '@stacksjs/path'

await runCommand('bun run build:app', {
  // ...options,
  cwd: corePath('desktop'),
})
