import process from 'node:process'
import { log } from '@stacksjs/cli'
import { cloud } from '@stacksjs/config'
import { buildServer, useCustomOrDefaultServerConfig } from './src/utils'

async function main() {
  await useCustomOrDefaultServerConfig()

  if (cloud.api?.deploy)
    await buildServer()
}

main().catch((error) => {
  log.error(`Build failed: ${error}`)
  process.exit(1)
})
