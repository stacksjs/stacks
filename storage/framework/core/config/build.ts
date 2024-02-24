import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/config...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: [
    '@stacksjs/types',
    '@stacksjs/tunnel',
    '@stacksjs/env',
    '@stacksjs/path',
    '@stacksjs/validation',
    '@vinejs/compiler',
    'pluralize',
    '@stacksjs/strings',
    'dinero.js',
    '@dinero.js/currencies',
    'validator',
    '@vinejs/vine',
  ],
  plugins: [
    dts({
      withSourceMap: true, // optional
    }),
  ],
})

log.success(`Built @stacksjs/config`)
