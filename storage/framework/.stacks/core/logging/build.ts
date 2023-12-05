import { log, runCommand } from '../cli/src'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:cli --external stacks:error-handling --external node-ray --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
