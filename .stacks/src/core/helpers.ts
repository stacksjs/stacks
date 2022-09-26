import { hasFile, readTextFile } from './fs'

export async function isInitialized(path: string) {
  if (hasFile('.env')) {
    const env = await readTextFile('.env', path)
    const lines = env.data.split('\n')
    const appKey = lines.find(line => line.startsWith('APP_KEY='))

    if (appKey && appKey.length > 8)
      return true
  }

  return false
}
