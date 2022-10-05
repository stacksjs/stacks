import ezSpawn from '@jsdevtools/ez-spawn'
import { isFile, readTextFile } from '../utils'

export async function isInitialized(path: string) {
  if (isFile('.env'))
    return await checkIfAppKeyIsSet(path)

  if (isFile('.env.example')) {
    await ezSpawn.async('pnpm artisan key:generate', { stdio: 'inherit', cwd: path })
    return await checkIfAppKeyIsSet(path)
  }

  return await checkIfAppKeyIsSet(path)
}

export async function checkIfAppKeyIsSet(path?: string) {
  if (!path)
    path = process.cwd()

  const env = await readTextFile('.env', path)
  const lines = env.data.split('\n')
  const appKey = lines.find(line => line.startsWith('APP_KEY='))

  if (appKey && appKey.length > 16)
    return true

  return false
}
