import { runCommand } from '@stacksjs/cli'

runCommand('bun build ./src/index.ts --outdir dist --format esm --external @vinejs/vine --external @stacksjs/utils --external @stacksjs/vite --target bun', {
  cwd: import.meta.dir,
})
