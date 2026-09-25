/**
 * No `.stx` client script may call a name the browser does not have
 * (stacksjs/stacks#2585).
 *
 * `storage/framework/types/browser-auto-imports.d.ts` declares 83 ambient
 * names, and the stx runtime attaches 61 globals; three names are in both. The
 * declarations are a leftover from `unplugin-auto-import`, which has not run in
 * a long time, so for the other 80 `buddy typecheck` accepts a bare call and
 * the browser raises a `ReferenceError` during setup. That does not degrade the
 * one call - it takes the whole root down unhydrated.
 *
 * Verified against the deployed site rather than inferred. On
 * `https://stacksjs.com/login`, `typeof window.state` and
 * `typeof window.useLocalStorage` are `function`, while `useAuth`,
 * `useScrollLock`, `useTimeoutFn`, `debounce` and `clamp` are all `undefined`.
 *
 * `skill-runtime-globals.test.ts` beside this one guards what the *docs* claim.
 * This guards what the *templates do*, which is the half that ships a broken
 * page. It derives the runtime the same way, by generating it, so neither list
 * is restated here and a name that starts or stops being a global is picked up
 * on the next run.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = new URL('../../../../../', import.meta.url).pathname

/**
 * Empty, and meant to stay that way.
 *
 * It held five components that could not hydrate - MobileSidebar, UI/Drawer and
 * UI/Modal on `useScrollLock`, KanbanCardDialog on `useTimeoutFn`, LogsDashboard
 * on `debounce`. Each now imports the name explicitly, verified through
 * `subpath-builds-are-listed.test.ts`, which resolves every `.stx` script's
 * workspace imports the way the deploy box does rather than the way a checkout
 * with `dist/` present does.
 *
 * An entry here is a defect being tracked, not a tolerated exception: a new bare
 * call fails this test, and so does an entry whose call is gone.
 */
const KNOWN_PHANTOM_USAGES: Record<string, string[]> = {}

/** The globals the served runtime actually attaches to `window`. */
async function runtimeGlobals(): Promise<Set<string>> {
  const { getCachedSignalsRuntime } = await import('@stacksjs/stx') as {
    getCachedSignalsRuntime: (minify: boolean) => Promise<string>
  }
  const source = await getCachedSignalsRuntime(false)
  const names = new Set<string>()
  for (const match of source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g))
    names.add(match[1]!)
  return names
}

/** Ambient names the browser declarations promise a template. */
function declaredGlobals(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(root, 'storage/framework/browser-auto-imports.json'), 'utf-8'),
  ) as { globals: Record<string, true> }
  return Object.keys(manifest.globals)
}

/**
 * Comments are stripped before anything is matched. A doc comment reading
 * "calls `useAuth().login`" in `views/login.stx` reads exactly like a call site
 * and is not one, which is the trap that makes a scan like this report
 * confidently wrong.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[^\n]*?\/\/[^\n]*$/gm, ' ')
}

/** Every `<script client>` body in a template, comments removed. */
function clientScripts(source: string): string {
  let joined = ''
  for (const match of source.matchAll(/<script\s+client[^>]*>([\s\S]*?)<\/script>/g))
    joined += `\n${match[1]}`
  return withoutComments(joined)
}

function callsIn(script: string): Set<string> {
  const names = new Set<string>()
  // A call not preceded by `.`, so `kanban.debounce()` is not read as `debounce`.
  for (const match of script.matchAll(/(^|[^\w.$])([A-Za-z_$][\w$]*)\s*\(/g))
    names.add(match[2]!)
  return names
}

function resolvedLocally(script: string, name: string): boolean {
  if (new RegExp(`(?:function|const|let|var|class)\\s+${name}\\b`).test(script))
    return true
  // Any import statement mentioning it, including a multi-line binding list.
  for (const statement of script.matchAll(/import\s[\s\S]*?from\s*'[^']*'/g)) {
    if (new RegExp(`\\b${name}\\b`).test(statement[0]))
      return true
  }
  return false
}

describe('stx client scripts only call names the browser has', () => {
  it('reports every bare call to a declared-but-absent global', async () => {
    const runtime = await runtimeGlobals()
    const phantom = new Set(declaredGlobals().filter(name => !runtime.has(name)))

    const found: Record<string, string[]> = {}
    const glob = new Bun.Glob('**/*.stx')
    for (const base of ['storage/framework/defaults/resources', 'resources']) {
      for await (const entry of glob.scan({ cwd: join(root, base), onlyFiles: true })) {
        const file = `${base}/${entry}`
        const script = clientScripts(readFileSync(join(root, file), 'utf-8'))
        if (!script.trim())
          continue

        const called = callsIn(script)
        const offenders = [...phantom]
          .filter(name => called.has(name) && !resolvedLocally(script, name))
          .sort()
        if (offenders.length > 0)
          found[file] = offenders
      }
    }

    /*
     * Asserted as "nothing new", not as an exact match, because which names are
     * phantom depends on the installed stx version and that is not pinned to one
     * value across every checkout: this repository requires Bun 1.4.2 and a
     * checkout on 1.4.1 resolves a different `@stacksjs/stx` than the lockfile's,
     * so an exact match is green on one machine and red in CI for a reason that
     * has nothing to do with the templates.
     */
    const unexpected = Object.entries(found)
      .map(([file, names]) => [file, names.filter(name => !(KNOWN_PHANTOM_USAGES[file] ?? []).includes(name))] as const)
      .filter(([, names]) => names.length > 0)
    expect(Object.fromEntries(unexpected)).toEqual({})

    /*
     * And the list can only shrink: a known entry whose name the runtime has
     * since started providing is no longer a defect, so it is only stale when the
     * name is still phantom here and the call is gone.
     */
    const stale = Object.entries(KNOWN_PHANTOM_USAGES)
      .map(([file, names]) => [file, names.filter(name => phantom.has(name) && !(found[file] ?? []).includes(name))] as const)
      .filter(([, names]) => names.length > 0)
    expect(Object.fromEntries(stale)).toEqual({})
  })
})
