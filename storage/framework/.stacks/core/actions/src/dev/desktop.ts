import { runCommand } from 'stacks:cli'
import { corePath } from 'stacks:path'

await runCommand('bun run dev:app', {
  // ...options,
  cwd: corePath('desktop'),
})
