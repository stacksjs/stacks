import { runCommand } from 'stacks:cli'
import { frameworkStoragePath } from 'stacks:path'

await runCommand('bun run dev', {
  cwd: frameworkStoragePath('views'),
  // verbose: true,
})
