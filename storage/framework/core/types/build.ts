await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',

  external: [
    '@stacksjs/validation',
    'consola',
    'unocss',
    '@unocss/core',
  ],

})
