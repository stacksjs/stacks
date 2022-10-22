import { getRandomValues } from 'node:crypto'
import consola from 'consola'
import ezSpawn from '@jsdevtools/ez-spawn'
// import { generateAppKey } from '@stacksjs/security'
import { projectPath } from '@stacksjs/paths'
import { setEnvValue } from '@stacksjs/helpers'
import utf8 from 'crypto-js/enc-utf8'
import base64 from 'crypto-js/enc-base64'

export async function generateAppKey() {
  const random = getRandomValues(new Uint8Array(32))
  const encodedWord = utf8.parse(random.toString())
  const key = base64.stringify(encodedWord)

  return `base64:${key}`
}

export async function generate() {
  consola.info('Setting random application key.')

  // if the .env file does not exist, ensure it is created
  if (!isFile('.env'))
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  await setEnvValue('APP_KEY', await generateAppKey())

  consola.success('Application key set.')

  return true
}
