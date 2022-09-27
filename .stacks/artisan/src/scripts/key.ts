import crypto from 'node:crypto'
import fs from 'fs-extra'
import consola from 'consola'
import { enc } from 'crypto-js'
import { resolve } from 'pathe'

export async function generate(path: string) {
  consola.info('Generating random application key.')

  const random = crypto.getRandomValues(new Uint8Array(32))
  const encodedWord = enc.Utf8.parse(random.toString())
  const key = enc.Base64.stringify(encodedWord)
  const APP_KEY = `base64:${key}`

  await setEnvValue('APP_KEY', APP_KEY, path)

  consola.success('Generated key.')
}

async function setEnvValue(key: string, value: string, path?: string) {
  path = resolve(path ?? process.cwd(), '.env')

  const raw = await fs.readFile(path, 'utf-8')
  const changed = raw.replace(/APP_KEY=/g, `APP_KEY=${value}`)

  await fs.writeFile(path, changed, 'utf-8')
}
