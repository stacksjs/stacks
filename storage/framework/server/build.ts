import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { userServerPath } from '@stacksjs/path'
import { intro, outro } from '../core/build/src'
import { buildDockerImage, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  const { startTime } = await intro({
    dir: import.meta.dir,
  })

  log.debug('Deleting old server files...')
  await runCommand(`rm -rf ${userServerPath('index.js*')}`)
  log.debug('Deleted old server files')
  log.debug('Deleting old *.node files...')
  await runCommand(`rm -rf ${userServerPath('*.node')}`)
  log.debug('Deleted old *.node files')

  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './',
    format: 'esm',
    target: 'bun',
    sourcemap: 'linked',
    // minify: true,
  })

  await outro({
    dir: import.meta.dir,
    startTime,
    result,
  })

  await useCustomOrDefaultServerConfig()

  log.debug('Building app...')

  await import('./build-app.ts')

  if (cloud.api?.deploy) await buildDockerImage()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
