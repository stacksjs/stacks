import { intro, outro } from '@stacksjs/build'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    'bun',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/cli',
    '@stacksjs/vite',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
