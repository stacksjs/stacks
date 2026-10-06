/**
 * Cache-busting URLs for the site's own stylesheets.
 *
 * public/ is served with `Cache-Control: public, max-age=3600` and the
 * stylesheets were linked by bare path, so after a deploy a returning visitor
 * kept the previous CSS for up to an hour against the new markup. New sections
 * rendered as unstyled text until the cache expired, which happened on
 * stacksjs.com the day the home page was rebuilt.
 *
 * `assetUrl('/assets/styles/home.css')` appends `?v=<content hash>`, so the URL
 * changes exactly when the file does and a cached copy can never be paired with
 * markup it was not written for.
 *
 * public/ is found by walking up from the working directory, never by counting
 * `..` from this module: in production the app runs from a bundle in
 * storage/framework/runtime/production, where relative path arithmetic from
 * import.meta.dir points somewhere else entirely. If the file still cannot be
 * read, the version falls back to the process start time, which changes on
 * every deploy and so still busts the cache, just less precisely.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const bootVersion = Date.now().toString(36)

function publicRoot(): string | undefined {
  let dir = process.cwd()

  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, 'public')
    if (existsSync(join(candidate, 'assets')))
      return candidate

    const parent = dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }

  return undefined
}

/**
 * The URL to link for a file under public/, with a version that changes when
 * the file's content does. Hashed on every call rather than memoised: the
 * stylesheets are tens of kilobytes, and a memo would pin the dev server to the
 * version it saw at boot while the CSS kept changing underneath it.
 */
export function assetUrl(path: string): string {
  const root = publicRoot()

  if (root) {
    try {
      const contents = readFileSync(join(root, path))
      return `${path}?v=${Bun.hash(contents).toString(36)}`
    }
    catch {}
  }

  return `${path}?v=${bootVersion}`
}
