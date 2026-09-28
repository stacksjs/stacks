/**
 * Route files that name an action the framework no longer ships.
 *
 * An app's `routes/` directory is its own: `buddy new` writes it once and
 * `buddy upgrade` never touches it, because anything there may have been
 * edited. So when a framework release removes an action that the scaffold's
 * routes pointed at, every app created before that release keeps a route to a
 * file that is gone. `route.get('/commands', 'Actions/Buddy/CommandsAction')`
 * in `routes/buddy.ts` is the case that prompted this: e05bb758db (#2056,
 * released in 0.74.5) removed the action, and every older app then failed
 * `buddy test:types` after upgrading, on a line it never wrote.
 *
 * Two levels of response, from safe to safest:
 *
 * - A statement the scaffold itself wrote, byte for byte apart from
 *   whitespace and its trailing comment, whose action resolves nowhere, is
 *   removed ({@link pruneRetiredScaffoldRoutes}). Only the entries listed in
 *   {@link RETIRED_SCAFFOLD_ROUTES}, only when the action is really gone, so
 *   an app that wrote its own `CommandsAction` keeps its route.
 * - Anything else that names a missing action is reported, never edited
 *   ({@link findDanglingRouteActions}), by `buddy upgrade` and `buddy doctor`.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface RetiredScaffoldRoute {
  /** The route file the scaffold wrote it into, relative to the project root. */
  file: string
  /** The statement exactly as the scaffold wrote it, without its comment. */
  statement: string
  /** The action it names. */
  action: string
  /** The first release that no longer ships the action. */
  removedIn: string
  reason: string
}

export const RETIRED_SCAFFOLD_ROUTES: RetiredScaffoldRoute[] = [
  {
    file: 'routes/buddy.ts',
    statement: `route.get('/commands', 'Actions/Buddy/CommandsAction')`,
    action: 'Actions/Buddy/CommandsAction',
    removedIn: '0.74.5',
    reason: 'the hand-written commands endpoint was dropped for `buddy list --json` (stacksjs/stacks#2056)',
  },
]

export interface RouteActionReference {
  /** Relative to the project root. */
  file: string
  /** 1-based. */
  line: number
  action: string
}

export interface PrunedScaffoldRoute extends RouteActionReference {
  removedIn: string
  reason: string
}

/**
 * Where an `'Actions/…'` handler can live: the app first, then the framework
 * defaults, vendored or installed. The same order the router resolves in.
 */
export function actionRoots(projectRoot: string): string[] {
  return [
    join(projectRoot, 'app'),
    join(projectRoot, 'storage/framework/defaults/app'),
    join(projectRoot, 'node_modules/@stacksjs/defaults/app'),
  ]
}

export function actionResolves(projectRoot: string, action: string): boolean {
  return actionRoots(projectRoot).some(root =>
    ['.ts', '.js'].some(extension => existsSync(join(root, `${action}${extension}`))),
  )
}

function routeFiles(dir: string): string[] {
  if (!existsSync(dir))
    return []
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      files.push(...routeFiles(path))
    else if (/\.[cm]?ts$/.test(entry) && !entry.endsWith('.d.ts'))
      files.push(path)
  }
  return files.sort()
}

/** The line with any `//` comment removed, outside of string literals. */
function withoutLineComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    if (quote) {
      if (char === '\\')
        i++
      else if (char === quote)
        quote = null
      continue
    }
    if (char === '\'' || char === '"' || char === '`')
      quote = char
    else if (char === '/' && line[i + 1] === '/')
      return line.slice(0, i)
  }
  return line
}

const normalize = (statement: string): string => statement.replace(/\s+/g, '').replace(/;$/, '')

/**
 * Every `'Actions/…'` string in the app's route files that resolves to no file.
 *
 * Literal handler strings only: a resource route composes its five names at
 * runtime, and a `Controller@method` handler is not an action path.
 */
export function findDanglingRouteActions(projectRoot: string): RouteActionReference[] {
  const dangling: RouteActionReference[] = []
  for (const path of routeFiles(join(projectRoot, 'routes'))) {
    const lines = readFileSync(path, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const code = withoutLineComment(line)
      if (/^\s*(?:\*|\/\*)/.test(code))
        return
      for (const match of code.matchAll(/(['"`])(Actions\/[\w/.-]+)\1/g)) {
        const action = match[2]!
        if (!actionResolves(projectRoot, action))
          dangling.push({ file: relative(projectRoot, path), line: index + 1, action })
      }
    })
  }
  return dangling
}

/**
 * Remove the retired scaffold routes an app still carries, where it carries
 * them unchanged and the action is gone. Returns what was (or, with `dryRun`,
 * would be) removed.
 */
export function pruneRetiredScaffoldRoutes(projectRoot: string, options: { dryRun?: boolean } = {}): PrunedScaffoldRoute[] {
  const pruned: PrunedScaffoldRoute[] = []

  for (const retired of RETIRED_SCAFFOLD_ROUTES) {
    const path = join(projectRoot, retired.file)
    if (!existsSync(path) || actionResolves(projectRoot, retired.action))
      continue

    const lines = readFileSync(path, 'utf8').split('\n')
    const kept = lines.filter((line, index) => {
      if (normalize(withoutLineComment(line)) !== normalize(retired.statement))
        return true
      pruned.push({ file: retired.file, line: index + 1, action: retired.action, removedIn: retired.removedIn, reason: retired.reason })
      return false
    })

    if (kept.length !== lines.length && !options.dryRun)
      writeFileSync(path, kept.join('\n'))
  }

  return pruned
}

/** One line per reference, for the upgrade summary and `buddy doctor`. */
export function describeDanglingRouteActions(references: RouteActionReference[]): string {
  return references.map(ref => `${ref.file}:${ref.line} names ${ref.action}, which no longer exists`).join('\n')
}
