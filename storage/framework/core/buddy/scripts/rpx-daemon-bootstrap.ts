/**
 * Spawned by `./buddy dev` to start the rpx HTTPS daemon.
 * Avoids the published `dist/bin/cli.js` duplicate-shebang issue on Bun 1.3.x.
 *
 * `@stacksjs/rpx` can't be resolved as a bare specifier from this directory
 * (buddy/scripts isn't on the package's resolution path), which crashes the
 * daemon and leaves :443 unbound — so the pretty URL refuses to connect. We
 * resolve an explicit entry instead.
 *
 * This must work for BOTH the unprivileged launch AND the root copy that rpx
 * re-execs via `sudo env HOME=… PATH=… <bun> <this file>` to bind :443 — and
 * that re-exec forwards only HOME/PATH, NOT RPX_MODULE. So we self-resolve from
 * paths derived from this file's location and HOME, with RPX_MODULE/bare as
 * extra fallbacks.
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveRpxEntry(): string | null {
  // This file lives at <root>/storage/framework/core/buddy/scripts/.
  const here = dirname(fileURLToPath(import.meta.url))
  const projectRoot = join(here, '..', '..', '..', '..', '..')
  const candidates = [
    process.env.RPX_MODULE,
    join(projectRoot, 'node_modules/@stacksjs/rpx/dist/index.js'),
    join(homedir(), 'Code/Tools/rpx/packages/rpx/dist/index.js'),
    join(projectRoot, 'pantry/@stacksjs/rpx/dist/src/index.js'),
  ].filter((p): p is string => Boolean(p))
  return candidates.find(p => existsSync(p)) ?? null
}

const entry = resolveRpxEntry()
const rpx = entry ? await import(entry) : await import('@stacksjs/rpx')
const { runDaemon } = rpx as typeof import('@stacksjs/rpx')

const handle = await runDaemon({ verbose: process.env.RPX_VERBOSE === '1' })
await handle.done
