import { runCommand } from 'src/cli/src'
import { frameworkStoragePath } from 'src/path/src'

await runCommand('bun run dev', {
  cwd: frameworkStoragePath('views'),
  // verbose: true,
})
