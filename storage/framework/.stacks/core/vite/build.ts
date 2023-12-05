import { runCommand } from 'stacks:cli'
import { handleError } from 'stacks:error-handling'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external markdown-it-shikiji --external unplugin-vue-macros/vite --external vite-plugin-webfont-dl --external unplugin-vue-markdown/vite --external unplugin-auto-import/vite --external @intlify/unplugin-vue-i18n/vite --external defu --external stacks:types --external stacks:path --external vite --external unplugin-vue-components/vite --external unocss/vite --external stacks:config --external stacks:cli --external vitepress --external vite-plugin-inspect --external vite-plugin-vue-layouts --external unplugin-vue-router --external unplugin-vue-router/vite --external vite-plugin-pwa --external @vitejs/plugin-vue --external stacks:alias --external vite-ssg-sitemap --external stacks:server --external stacks:env --external @unhead/vue --external stacks:vite-plugin-vue-layouts --external markdown-it-link-attributes --external vite-plugin-vue-devtools --external vite-plugin-pages --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)
