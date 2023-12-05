import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/runtime/server.ts --outdir src/runtime --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
