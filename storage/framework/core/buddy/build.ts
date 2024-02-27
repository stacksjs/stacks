import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: [
    './src/index.ts',
    './src/cli.ts',
  ],

  outdir: './dist',
  format: 'esm',
  target: 'bun',
  splitting: true,

  external: [
    '@stacksjs/ai',
    '@stacksjs/actions',
    '@stacksjs/enums',
    '@stacksjs/config',
    '@stacksjs/dns',
    '@stacksjs/error-handling',
    '@stacksjs/cli',
    '@stacksjs/cloud',
    '@stacksjs/logging',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/types',
    '@aws-sdk/client-route-53',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
