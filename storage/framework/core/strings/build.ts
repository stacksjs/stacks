import { intro, outro } from '@stacksjs/build'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',

  external: [
    'change-case',
    'title-case',
    'validator',
    'pluralize',
    'slugify',
    'detect-indent',
    'detect-newline',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
