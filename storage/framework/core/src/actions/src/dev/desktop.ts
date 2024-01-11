import { runCommand } from '@stacksjs/cli'
import { corePath } from '@stacksjs/path'

await runCommand('bun run dev:app', {
  // ...options,
  cwd: corePath('desktop'),
})
