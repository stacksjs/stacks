/**
 * Build script for @stacksjs/stx-ui
 */
import { $ } from 'bun'

async function build() {
  console.log('Building @stacksjs/stx-ui...')

  // Clean dist
  await $`rm -rf dist`

  // Build web components
  await Bun.build({
    entrypoints: ['./src/web-components/index.ts'],
    outdir: './dist/web-components',
    target: 'browser',
    format: 'esm',
    minify: false,
  })

  // Build composables
  await Bun.build({
    entrypoints: ['./src/composables/index.ts'],
    outdir: './dist/composables',
    target: 'browser',
    format: 'esm',
    minify: false,
    external: ['vue'],
  })

  // Build main index
  await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'browser',
    format: 'esm',
    minify: false,
    external: ['vue'],
  })

  // Generate type declarations
  await $`bunx tsc --emitDeclarationOnly --declaration --outDir dist`

  console.log('Build complete!')
}

build().catch(console.error)
