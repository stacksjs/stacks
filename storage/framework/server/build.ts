import process from 'node:process'
import { log } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { intro, outro } from '../core/build/src'
import { buildDockerImage, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  const { startTime } = await intro({
    dir: import.meta.dir,
  })

  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    format: 'esm',
    target: 'bun',
    sourcemap: 'linked',
    minify: true,
  })

  await outro({
    dir: import.meta.dir,
    startTime,
    result,
  })

  await useCustomOrDefaultServerConfig()

  log.info('Building app...')

  await import('./build-app.ts')

  if (cloud.api?.deploy) await buildDockerImage()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
