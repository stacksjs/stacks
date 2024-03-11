await Bun.build({
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
