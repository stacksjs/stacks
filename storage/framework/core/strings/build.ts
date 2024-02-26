import dts from 'bun-plugin-dts-auto'

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

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
