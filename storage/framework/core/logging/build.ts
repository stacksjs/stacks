await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/path',
    '@stacksjs/types',
  ],

})
