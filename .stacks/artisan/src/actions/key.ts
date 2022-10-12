import crypto from 'node:crypto'
import fs from 'fs-extra'
import consola from 'consola'
import { enc } from 'crypto-js'
import ezSpawn from '@jsdevtools/ez-spawn'
import { isFile } from '../../../src/utils/fs'
import { projectPath } from '../../../src/utils/helpers'

export async function generate() {
  consola.info('Setting random application key.')

  // if the .env file does not exist, ensure it is created
  if (!isFile('.env'))
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  await setEnvValue('APP_KEY', await generateAppKey())

  consola.success('Application key set.')

  return true
}

export async function generateAppKey() {
  const random = crypto.getRandomValues(new Uint8Array(32))
  const encodedWord = enc.Utf8.parse(random.toString())
  const key = enc.Base64.stringify(encodedWord)

  return `base64:${key}`
}

async function setEnvValue(key: string, value: string) {
  const path = projectPath('.env')
  const raw = await fs.readFile(path, 'utf-8')
  const changed = raw.replace(/APP_KEY=/g, `APP_KEY=${value}`)

  await fs.writeFile(path, changed, 'utf-8')
}
