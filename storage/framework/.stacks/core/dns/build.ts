import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external aws-cdk-lib --external stacks:enums --external @aws-sdk/client-route-53 --external constructs --external stacks:config --external stacks:storage --external stacks:error-handling --external stacks:actions --external stacks:strings --external stacks:logging --external stacks:path --external stacks:error-handling --external stacks:whois --external @aws-sdk/client-route-53-domains --external stacks:types --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
