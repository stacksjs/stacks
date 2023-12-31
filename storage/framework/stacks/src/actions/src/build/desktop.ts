import { runCommand } from 'src/cli/src'
import { corePath } from 'src/path/src'

await runCommand('bun run build:app', {
  // ...options,
  cwd: corePath('desktop'),
})
