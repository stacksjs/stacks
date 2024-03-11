await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',

  external: [
    '@stacksjs/cli',
    '@stacksjs/path',
  ],

})
