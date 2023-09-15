import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @aws-lambda-powertools/metrics --external @aws-lambda-powertools/logger --external @aws-lambda-powertools/tracer --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)

const result2 = await runCommand('bun build ./src/drivers/aws/runtime/server.ts --outdir src/drivers/aws/runtime/dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result2.isErr())
  log.error(result2.error)
