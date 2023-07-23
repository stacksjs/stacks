import { log, runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external vite --external vitepress --external @stacksjs/path --external @stacksjs/cli --external @stacksjs/config --external @stacksjs/types --external @stacksjs/alias --external @stacksjs/validation --external vite-plugin-mkcert --external kolorist --external @stacksjs/server --external unplugin-auto-import/vite --external unplugin-vue-components/vite --external @vitejs/plugin-vue --external unocss/vite --external vite-plugin-inspect --external vite-plugin-pages --external vite-plugin-pwa --external pnpapi --external defu --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)

else
  log.success('Build complete')
