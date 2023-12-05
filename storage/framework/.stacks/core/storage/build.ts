import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external aws-cdk-lib --external constructs --external stacks:config --external stacks:arrays --external stacks:path --external stacks:error-handling --external stacks:cli --external fs-extra --external fast-glob --external stacks:logging --external stacks:cli --external stacks:strings --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
