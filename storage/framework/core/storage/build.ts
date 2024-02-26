import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/env',
    '@stacksjs/error-handling',
    '@stacksjs/types',
    '@stacksjs/strings',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/error-handling',
    '@stacksjs/whois',
    '@stacksjs/arrays',
    '@stacksjs/strings',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
