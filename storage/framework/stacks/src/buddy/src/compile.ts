import { log, runCommand } from 'src/cli/src'

// bun build ./storage/framework/stacks/core/buddy/src/cli.ts --external @stacksjs/utils --compile --outfile budd --minify
const result = await runCommand('bun build ./src/cli.ts --compile --outfile budd', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
