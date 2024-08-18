import { intro, outro } from './src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',
  minify: true,

  external: [
    'bun',
    '@babel/parser',
    '@babel/traverse',
    '@babel/generator',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/cli',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
