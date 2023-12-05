import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external aws-cdk-lib --external @aws-sdk/client-route-53 --external constructs --external @stacksjs/config --external @stacksjs/storage --external @stacksjs/error-handling --external @stacksjs/actions --external @stacksjs/strings --external @stacksjs/logging --external @stacksjs/path --external @stacksjs/error-handling --external @stacksjs/whois --external @aws-sdk/client-route-53-domains --external @stacksjs/types --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)