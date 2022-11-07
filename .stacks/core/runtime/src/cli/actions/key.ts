import { getRandomValues } from 'node:crypto'
import { log, runCommand } from '@stacksjs/cli'
// import { generateAppKey } from '@stacksjs/security'
import type { CliOptions as KeyOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { setEnvValue } from '@stacksjs/utils'
import { isFile } from '@stacksjs/storage'
import utf8 from 'crypto-js/enc-utf8'
import base64 from 'crypto-js/enc-base64'

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
  try {
    log.info('Setting random application key.')

    if (!isFile('.env'))
      await runCommand('cp .env.example .env', options)
      // spawn('cp .env.example .env', { stdio: debug, cwd: projectPath() })

    await setEnvValue('APP_KEY', await generateAppKey())
    log.success('Application key set.')

    return true
  }
  catch (error) {
    log.error('There was an error generating your key.')
    log.error(error)
    process.exit(ExitCode.FatalError)
  }
}

export async function generateAppKey() {
  const random = getRandomValues(new Uint8Array(32))
  const encodedWord = utf8.parse(random.toString())
  const key = base64.stringify(encodedWord)

  return `base64:${key}`
}
