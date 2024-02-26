import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@faker-js/faker',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
