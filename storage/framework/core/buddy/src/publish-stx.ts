/**
 * `buddy publish:component` and `buddy publish:view`: copy one default `.stx`
 * file into the app, at the path a server reads the app's copy from
 * (stacksjs/stacks#3032).
 *
 * Without these an app could only change a default template by vendoring the
 * whole defaults tree (`buddy publish:defaults`, 2,600+ files), and every
 * `buddy upgrade` then showed hundreds of framework files as app changes.
 *
 * Two things make a published template more than a copy:
 *
 * - **It has to be read.** Each tree below names where its app copy lives, and
 *   the subtrees no server reads an app copy of are refused rather than
 *   published as a file that silently does nothing.
 * - **It has to run.** Default templates import the framework's helpers by
 *   relative path (`../../../../functions/dashboard-api`), which resolves
 *   inside the defaults tree and nowhere else. Those imports are pointed at
 *   `@stacksjs/defaults/...`, so the copy keeps using the framework's helpers
 *   instead of forking them into the app.
 */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { globSync } from '@stacksjs/storage'
import { defaultsSpecifier } from './scaffold-package-app'

export type StxResourceKind = 'component' | 'view'

interface StxTree {
  /** The tree, relative to the defaults root. */
  from: string
  /** Where the app's copy of a file in it goes, relative to the project root. */
  to: string
  /** First path segments no server reads an app copy of, with the reason. */
  frameworkOnly?: Record<string, string>
}

export const COMPONENT_TREE: StxTree = {
  from: 'resources/components',
  to: 'resources/components',
  frameworkOnly: {
    Email: 'email templates resolve components from the framework\'s Email directory only (stacksjs/stacks#3032)',
  },
}

/**
 * Searched in order. The dashboard's comes first because
 * `resources/views/dashboard` is the dashboard server's own page directory,
 * so `dashboard/index` means the dashboard's home, not the site's page of the
 * same path.
 */
export const VIEW_TREES: StxTree[] = [
  {
    from: 'views/dashboard',
    to: 'resources/views/dashboard',
    frameworkOnly: {
      layouts: 'the dashboard renders its layouts from the framework only',
    },
  },
  { from: 'resources/views', to: 'resources/views' },
]

export type StxLookup =
  | { ok: true, source: string, target: string }
  | { ok: false, message: string, details: string[] }

/** `Dashboard/Commerce/Foo.stx` and `/Dashboard/Commerce/Foo` both name `Dashboard/Commerce/Foo`. */
function normalizeName(name: string): string | undefined {
  const cleaned = name.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.stx$/, '')
  if (!cleaned || cleaned.split('/').includes('..'))
    return undefined
  return cleaned
}

function refusal(tree: StxTree, relativePath: string): string | undefined {
  return tree.frameworkOnly?.[relativePath.split('/')[0] ?? '']
}

/**
 * Find a default component by name, or by its path under
 * `resources/components` when the name alone is ambiguous.
 */
function locateComponent(name: string, defaultsRoot: string, projectRoot: string): StxLookup {
  const tree = COMPONENT_TREE
  const base = join(defaultsRoot, tree.from)

  // An exact path wins, as a direct file wins over one in a subdirectory when
  // stx resolves the tag. Otherwise `Pagination` could never name the
  // top-level component while `Dashboard/UI/Pagination` exists too.
  const matches = existsSync(join(base, `${name}.stx`))
    ? [`${name}.stx`]
    : name.includes('/') ? [] : globSync([`**/${name}.stx`], { cwd: base }).sort()

  if (matches.length === 0)
    return { ok: false, message: `Could not find a default component named ${name}`, details: [`Looked under: ${base}`] }

  if (matches.length > 1) {
    return {
      ok: false,
      message: `${matches.length} default components are named ${name}. Pass the one you mean by its path:`,
      details: matches.map(match => `buddy publish:component ${match.replace(/\.stx$/, '')}`),
    }
  }

  const relativePath = matches[0]!
  const reason = refusal(tree, relativePath)
  if (reason)
    return { ok: false, message: `${relativePath} cannot be overridden from the app: ${reason}.`, details: [] }

  return { ok: true, source: join(base, relativePath), target: join(projectRoot, tree.to, relativePath) }
}

/**
 * Find a default view by the path its copy will have under `resources/views`,
 * so `dashboard/commerce/orders` publishes the dashboard's orders page.
 */
function locateView(name: string, defaultsRoot: string, projectRoot: string): StxLookup {
  const looked: string[] = []

  for (const tree of VIEW_TREES) {
    const prefix = tree.to.slice('resources/views'.length).replace(/^\//, '')
    if (prefix && name !== prefix && !name.startsWith(`${prefix}/`))
      continue

    const inTree = prefix ? name.slice(prefix.length).replace(/^\//, '') : name
    const base = join(defaultsRoot, tree.from)
    looked.push(base)

    const candidates = inTree ? [`${inTree}.stx`, `${inTree}/index.stx`] : ['index.stx']
    for (const relativePath of candidates) {
      if (!existsSync(join(base, relativePath)))
        continue

      const reason = refusal(tree, relativePath)
      if (reason)
        return { ok: false, message: `${name} cannot be overridden from the app: ${reason}.`, details: [] }

      return { ok: true, source: join(base, relativePath), target: join(projectRoot, tree.to, relativePath) }
    }
  }

  return { ok: false, message: `Could not find a default view at ${name}`, details: looked.map(dir => `Looked under: ${dir}`) }
}

export function locateDefaultStx(kind: StxResourceKind, name: string, defaultsRoot: string, projectRoot: string): StxLookup {
  const normalized = normalizeName(name)
  if (!normalized)
    return { ok: false, message: `Not a ${kind} name: ${name}`, details: [] }

  return kind === 'component'
    ? locateComponent(normalized, defaultsRoot, projectRoot)
    : locateView(normalized, defaultsRoot, projectRoot)
}

/** A relative specifier after `from`, `import(` or a bare `import`. */
const RELATIVE_IMPORT = /(\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)(['"])(\.{1,2}\/[^'"]+)\2/gm

/**
 * Point a template's relative imports of the defaults tree at
 * `@stacksjs/defaults`, as they resolve from where the template came from.
 *
 * Without a `.ts` extension: a template's script is checked by
 * `stx typecheck`, which rejects one, and Bun resolves the bare path through
 * the package's exports.
 */
export function pointImportsAtDefaults(source: string, sourcePath: string, defaultsRoot: string): { code: string, rewritten: number } {
  let rewritten = 0

  const code = source.replace(RELATIVE_IMPORT, (match, lead: string, quote: string, specifier: string) => {
    const inTree = relative(defaultsRoot, resolve(dirname(sourcePath), specifier))
    if (!inTree || inTree.startsWith('..') || isAbsolute(inTree))
      return match

    rewritten++
    return `${lead}${quote}${defaultsSpecifier(inTree.replace(/\\/g, '/'))}${quote}`
  })

  return { code, rewritten }
}
