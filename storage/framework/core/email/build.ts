import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/types',
    'vue-email',
    '@vue-email/compiler',
    'json5',
    '@stacksjs/path',
    '@aws-sdk/client-ses',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
