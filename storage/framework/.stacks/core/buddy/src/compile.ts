import { log, runCommand } from 'stacks:cli'

// bun build ./storage/framework/.stacks/core/buddy/src/cli.ts --external stacks:utils --compile --outfile budd --minify
const result = await runCommand('bun build ./src/cli.ts --compile --outfile budd', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
