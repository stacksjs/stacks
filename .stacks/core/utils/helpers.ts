import { isFile, readTextFile } from '../utils'
import { generate as generateAppKey } from '../../artisan/src/scripts/key'

export async function isInitialized(path: string) {
  if (isFile('.env')) {
    const env = await readTextFile('.env', path)
    const lines = env.data.split('\n')
    const appKey = lines.find(line => line.startsWith('APP_KEY='))

    if (appKey && appKey.length > 16)
      return true
  }

  if (isFile('.env.example')) {
    await generateAppKey(process.cwd())

    return true
  }

  return false
}
