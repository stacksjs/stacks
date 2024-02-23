import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/docs...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  external: [
    'vitepress',
    '@stacksjs/config',
    '@stacksjs/alias',
    '@stacksjs/path',
    '@stacksjs/vite',
    '@stacksjs/server',
    '@stacksjs/env',
    '@stacksjs/cli',
    '@vite-pwa/vitepress',
    'vitepress-plugin-twoslash',
  ],
  plugins: [
    dts({
      withSourceMap: true, // optional
    }),
  ],
})

log.success(`Built @stacksjs/docs`)