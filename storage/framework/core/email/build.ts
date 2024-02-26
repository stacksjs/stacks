import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/types',
    '@maizzle/framework',
    'json5',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
