import { isFile, readTextFile } from '.'

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

export function kebabCase(string: string): string {
  return string.replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

