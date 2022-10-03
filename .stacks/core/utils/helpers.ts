import { isFile, readTextFile } from '../utils'

export async function isInitialized(path: string) {
  if (isFile('.env')) {
    const env = await readTextFile('.env', path)
    const lines = env.data.split('\n')
    const appKey = lines.find(line => line.startsWith('APP_KEY='))

    if (appKey && appKey.length > 16)
      return true
  }

  return false
}
