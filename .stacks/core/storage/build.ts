import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external aws-cdk-lib --external constructs --external @stacksjs/config --external @stacksjs/arrays --external @stacksjs/path --external @stacksjs/error-handling --external @stacksjs/cli --external fs-extra --external fast-glob --external @stacksjs/logging --external @stacksjs/cli --external @stacksjs/strings', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
