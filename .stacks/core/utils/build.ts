import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external @stacksjs/cli --external @stacksjs/path --external @stacksjs/storage --external @stacksjs/arrays --external @stacksjs/types --external export-size --external yaml --external js-yaml --external vue --external rimraf --external semver --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)

else
  log.success('Build complete')
