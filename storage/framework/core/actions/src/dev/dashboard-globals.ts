/**
 * Hoist every helper exported from the dashboard's resources/functions
 * tree (and the user's app/ helpers) onto globalThis so `<script server>`
 * blocks can use them as bare names without imports.
 *
 * Why this exists
 * ---------------
 * The STX dev server evaluates `<script server>` blocks inside an
 * AsyncFunction wrapper that inherits its identifier scope from
 * globalThis. The orm preload uses this trick to expose model classes
 * (`Order`, `Product`, …) as globals; this module does the same for
 * helper functions (`safeAll`, `formatRelative`, `listPackages`, …).
 *
 * The walk is shallow — direct children of each scanned directory only —
 * so we don't drag arbitrary nested modules into globals (unsafe and
 * slow). Anything deeper than that should be imported explicitly.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { projectPath, storagePath } from '@stacksjs/path'

interface HoistOptions {
  verbose?: boolean
}

const HELPER_DIRS = [
  // Framework defaults — small set of dashboard helpers shipped with stacks.
  storagePath('framework/defaults/resources/functions/dashboard'),
  // User helpers — anything the project drops into resources/functions or
  // app/Helpers will be picked up too. Both directories are scanned
  // shallowly, so a flat `resources/functions/foo.ts` works but a deeply
  // nested `resources/functions/payments/stripe/foo.ts` won't auto-hoist.
  projectPath('resources/functions'),
  projectPath('app/Helpers'),
]

export async function hoistDashboardGlobals(opts: HoistOptions = {}): Promise<void> {
  const g = globalThis as Record<string, any>
  const collisions: string[] = []
  let hoisted = 0

  for (const dir of HELPER_DIRS) {
    if (!existsSync(dir)) continue
    let entries: string[]
    try { entries = readdirSync(dir) }
    catch { continue }
    for (const entry of entries) {
      const full = join(dir, entry)
      let s
      try { s = statSync(full) }
      catch { continue }
      if (s.isDirectory()) {
        // Walk one level into subdirectories so the dashboard helpers
        // (data.ts, system.ts, library.ts, analytics.ts) live under
        // resources/functions/dashboard/ get picked up too.
        let subEntries: string[]
        try { subEntries = readdirSync(full) }
        catch { continue }
        for (const sub of subEntries) {
          if (!isImportable(sub)) continue
          const subFull = join(full, sub)
          // eslint-disable-next-line no-await-in-loop
          const r = await hoistFile(subFull, g, opts.verbose)
          hoisted += r.added
          collisions.push(...r.collisions)
        }
        continue
      }
      if (!isImportable(entry)) continue
      const r = await hoistFile(full, g, opts.verbose)
      hoisted += r.added
      collisions.push(...r.collisions)
    }
  }

  if (opts.verbose) {
    process.stdout.write(`[dashboard] hoisted ${hoisted} helper globals` + (collisions.length > 0 ? ` (skipped ${collisions.length} collisions: ${collisions.slice(0, 5).join(', ')}…)` : '') + '\n')
  }
}

function isImportable(name: string): boolean {
  if (!/\.(?:ts|tsx|js|mjs)$/.test(name)) return false
  if (name.startsWith('_')) return false
  if (name.endsWith('.test.ts') || name.endsWith('.spec.ts')) return false
  if (name.endsWith('.d.ts')) return false
  return true
}

async function hoistFile(file: string, g: Record<string, any>, _verbose?: boolean): Promise<{ added: number, collisions: string[] }> {
  let mod: any
  try { mod = await import(file) }
  catch { return { added: 0, collisions: [] } }
  const collisions: string[] = []
  let added = 0
  for (const [name, value] of Object.entries(mod)) {
    if (name === 'default' || name.startsWith('_')) continue
    if (typeof value === 'function' || (value && typeof value === 'object')) {
      if (g[name] === undefined) {
        g[name] = value
        added++
      }
      else if (g[name] !== value) {
        collisions.push(name)
      }
    }
  }
  return { added, collisions }
}
