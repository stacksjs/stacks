import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external vitepress --external @stacksjs/config --external @stacksjs/path --external @stacksjs/vite --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
