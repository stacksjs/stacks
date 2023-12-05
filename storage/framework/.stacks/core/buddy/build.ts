import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts ./src/cli.ts --outdir dist --format esm --target bun --external stacks:actions --external stacks:enums --external stacks:config --external stacks:dns --external stacks:error-handling --external stacks:cli --external stacks:cloud --external stacks:logging --external stacks:utils --external stacks:validation --external stacks:path --external stacks:storage --external stacks:types --external @aws-sdk/client-route-53 --splitting --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
