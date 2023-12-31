import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts --external @novu/stateless --external @stacksjs/cli --external @stacksjs/error-handling --external @novu/discord --external @novu/ms-teams --external @novu/node --external @novu/slack --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
