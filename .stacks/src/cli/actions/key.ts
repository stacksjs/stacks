import consola from 'consola'
import ezSpawn from '@jsdevtools/ez-spawn'
import { generateAppKey } from '@stacksjs/security'
import { projectPath, setEnvValue } from '@stacksjs/utils'

export async function generate() {
  consola.info('Setting random application key.')

  // if the .env file does not exist, ensure it is created
  if (!isFile('.env'))
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  await setEnvValue('APP_KEY', await generateAppKey())

  consola.success('Application key set.')

  return true
}
