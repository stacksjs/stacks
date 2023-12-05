import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/server/inbound.ts --outdir dist --external aws-sdk --format esm --target node', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
