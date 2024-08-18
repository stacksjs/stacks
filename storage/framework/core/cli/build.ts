import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  sourcemap: 'linked',
  minify: true,

  external: [
    'vite',
    '@antfu/install-pkg',
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/tunnel',
    '@stacksjs/logging',
    'prompts',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@stacksjs/error-handling',
    'ora',
    'kolorist',
    'cac',
    '@stacksjs/collections',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
