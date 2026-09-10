/**
 * A static file server for the Lighthouse audit (stacksjs/stacks#1222).
 *
 * A script rather than a `bunx serve` one-liner, for two reasons. `bunx serve`
 * is ambiguous here - `bun-plugin-stx` ships a bin of that name, so the
 * resolution depends on what is installed rather than on what was asked for.
 * And a workflow step that cannot be run locally is a step nobody checks until
 * it fails on a runner.
 *
 * Usage: `bun .github/lighthouse/serve.ts <dir> [port]`
 */

import { existsSync, statSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.argv[2] ?? 'dist/docs')
const port = Number(process.argv[3] ?? 4173)

if (!existsSync(root)) {
  process.stderr.write(`[serve] ${root} does not exist\n`)
  process.exit(1)
}

/**
 * Map a request path to a file inside `root`, or `null`.
 *
 * `..` is normalized away before joining rather than checked for afterwards:
 * this serves a build directory on a CI runner, and a traversal would read the
 * checkout. Cheap to get right, embarrassing to get wrong.
 */
export function resolveFile(root: string, pathname: string): string | null {
  const decoded = decodeURIComponent(pathname)
  // Normalize first, then strip every leading `..` segment, so `/../../etc`
  // cannot escape.
  const relative = normalize(decoded).replace(/^(?:\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  const candidate = join(root, relative)

  if (!candidate.startsWith(root))
    return null

  if (existsSync(candidate) && statSync(candidate).isFile())
    return candidate

  // Directory or extensionless route: try the index and the .html sibling,
  // which is how a static docs build addresses its own pages.
  for (const suffix of ['/index.html', '.html']) {
    const withSuffix = `${candidate.replace(/\/$/, '')}${suffix}`
    if (existsSync(withSuffix) && statSync(withSuffix).isFile())
      return withSuffix
  }

  return null
}

if (import.meta.main) {
  Bun.serve({
    port,
    fetch(request) {
      const file = resolveFile(root, new URL(request.url).pathname)

      // 404 rather than falling back to index.html. An SPA fallback would make
      // Lighthouse score the home page for a URL that does not exist, and
      // report a healthy site with a broken link in it.
      if (!file)
        return new Response('Not Found', { status: 404 })

      return new Response(Bun.file(file))
    },
  })

  process.stdout.write(`[serve] ${root} on http://localhost:${port}\n`)
}
