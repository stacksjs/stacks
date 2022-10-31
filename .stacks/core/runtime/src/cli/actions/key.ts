import { getRandomValues } from 'node:crypto'
import { consola, spawn } from '@stacksjs/cli'
// import { generateAppKey } from '@stacksjs/security'
import type { CliOptions as KeyOptions } from '@stacksjs/types'
import { projectPath } from '@stacksjs/path'
import { setEnvValue } from '@stacksjs/utils'
import { isFile } from '@stacksjs/storage'
import utf8 from 'crypto-js/enc-utf8'
import base64 from 'crypto-js/enc-base64'
import { debugLevel } from '@stacksjs/config'

export async function invoke(options: KeyOptions) {
  await generate(options)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function key(options: KeyOptions) {
  return invoke(options)
}

export async function generate(options: KeyOptions) {
  consola.info('Setting random application key.')
  const debug = debugLevel(options)

  // if the .env file does not exist, ensure it is created
  if (!isFile('.env'))
    await spawn.async('cp .env.example .env', { stdio: debug, cwd: projectPath() })

  await setEnvValue('APP_KEY', await generateAppKey())
  consola.success('Application key set.')

  return true
}

export async function generateAppKey() {
  const random = getRandomValues(new Uint8Array(32))
  const encodedWord = utf8.parse(random.toString())
  const key = base64.stringify(encodedWord)

  return `base64:${key}`
}
