// import { dts } from 'bun-plugin-dts-auto'
import { intro, outro } from '../build/src'
import { dts } from './dts'

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
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/tunnel',
    '@stacksjs/logging',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@stacksjs/error-handling',
    '@stacksjs/collections',
  ],

  plugins: [
    dts({
      root: './src',
      tsconfigPath: './tsconfig.json',
      compiler: {
        // Override specific compiler options here
        isolatedModules: true,
        skipLibCheck: true,
        // Add any other compiler options you want to override
      },
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
