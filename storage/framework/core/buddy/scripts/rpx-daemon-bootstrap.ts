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

// This file lives at <root>/storage/framework/core/buddy/scripts/.
const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..', '..', '..', '..', '..')

function resolveRpxEntry(): string | null {
  const candidates = [
    process.env.RPX_MODULE,
    join(projectRoot, 'node_modules/@stacksjs/rpx/dist/index.js'),
    join(homedir(), 'Code/Tools/rpx/packages/rpx/dist/index.js'),
    join(projectRoot, 'pantry/@stacksjs/rpx/dist/src/index.js'),
  ].filter((p): p is string => Boolean(p))
  return candidates.find(p => existsSync(p)) ?? null
}

/**
 * On-demand sites are ON by default for Stacks: the shared daemon lazily boots a
 * sibling app's dev server the first time you open its `<name>.localhost` URL, so
 * you never start them by hand. The default scan root is the folder this app
 * lives in (its siblings), derived from this file's location so it survives the
 * sudo re-exec that binds :443. Override the roots with `STACKS_RPX_SITE_ROOTS`
 * (comma-separated) or turn the whole thing off with `STACKS_RPX_ON_DEMAND=0`.
 *
 * Typed loosely so this compiles against any installed `@stacksjs/rpx` version
 * (the field is ignored by older builds that predate on-demand sites).
 */
function resolveOnDemandSites(): { enabled: boolean, roots: string[] } | undefined {
  if (process.env.STACKS_RPX_ON_DEMAND === '0')
    return undefined
  const rootsEnv = process.env.STACKS_RPX_SITE_ROOTS
  const roots = rootsEnv
    ? rootsEnv.split(',').map(r => r.trim()).filter(Boolean)
    : [dirname(projectRoot)] // the directory your app lives in → its siblings boot on demand
  return { enabled: true, roots }
}

const entry = resolveRpxEntry()
const rpx = entry ? await import(entry) : await import('@stacksjs/rpx')
const { runDaemon } = rpx as typeof import('@stacksjs/rpx')

const daemonOptions: Record<string, unknown> = { verbose: process.env.RPX_VERBOSE === '1' }
const onDemandSites = resolveOnDemandSites()
if (onDemandSites)
  daemonOptions.onDemandSites = onDemandSites

const handle = await runDaemon(daemonOptions as Parameters<typeof runDaemon>[0])
await handle.done
