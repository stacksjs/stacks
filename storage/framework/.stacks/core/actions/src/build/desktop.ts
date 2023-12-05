import { runCommand } from 'stacks:cli'
import { corePath } from 'stacks:path'

await runCommand('bun run build:app', {
  // ...options,
  cwd: corePath('desktop'),
})
