import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:chat --external stacks:cli --external stacks:config --external stacks:email --external stacks:error-handling --external stacks:push --external stacks:sms --external stacks:types --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
