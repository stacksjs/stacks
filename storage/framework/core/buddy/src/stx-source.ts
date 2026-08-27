import { existsSync } from 'node:fs'

/**
 * Which copy of stx the production server should render through.
 *
 * The answer is "the installed dependency" unless an operator names another
 * one by path. It used to be "a hardcoded worktree under `~/Code`, else the
 * project's `pantry/` directory, else the installed dependency", chosen
 * silently and in that order.
 *
 * That inverted the thing a deployment depends on: an untracked directory
 * outranked the declared dependency in the server that answers real traffic.
 * stacksjs/stacks#2369 is what it cost - an app on `bun-plugin-stx@0.2.231`
 * served every page through a `pantry/bun-plugin-stx@0.2.76` copy from four
 * months earlier, which predates the page-response read-back added in 0.2.219.
 * Pages calling `notFound()` recorded a 404 that nothing read, so deleted
 * pages answered 200 with their own not-found body.
 *
 * Kept in its own module so the rule can be tested without binding a port.
 */
export type StxSource =
  /** Use the package resolved from `node_modules`. */
  | { kind: 'installed' }
  /** Use the file the operator named, which is present. */
  | { kind: 'override', path: string }
  /** The operator named a file that is not there. Refuse rather than guess. */
  | { kind: 'missing', path: string }

export interface ResolveStxSourceOptions {
  /** Raw environment value, if any. */
  value: string | undefined
  /** Injected for tests. */
  exists?: (path: string) => boolean
}

export function resolveStxSource(options: ResolveStxSourceOptions): StxSource {
  const exists = options.exists ?? existsSync
  // An empty or whitespace-only value is an unset variable that went through a
  // shell, not a request for a copy at the path `''`.
  const path = options.value?.trim()
  if (!path)
    return { kind: 'installed' }

  return exists(path) ? { kind: 'override', path } : { kind: 'missing', path }
}
