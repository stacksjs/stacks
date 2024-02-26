import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    '@stacksjs/faker',
    '@stacksjs/path',
    '@stacksjs/query-builder',
    '@stacksjs/storage',
    '@stacksjs/strings',
    '@stacksjs/utils',
    'kysely',
    'mysql2',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
