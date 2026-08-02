import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

/**
 * These tools operate on the framework repository, not on an app.
 *
 * Each one locates its files by counting `../` up from its own source, so the
 * root it edits is wherever the module happens to live. In a consumer app that
 * resolves buddy from a linked framework checkout, that root is the framework
 * checkout - so `buddy docs:artifacts` run from an application regenerated and
 * overwrote the FRAMEWORK's `openapi.json`, from routes belonging to a
 * different project entirely.
 *
 * The failure that surfaced first was milder and more confusing: the generator
 * read the app's routes but compared them against the framework's artifact and
 * reported "no routes were registered". Nobody would guess from that message
 * that the command was editing another repository.
 *
 * So they refuse to run unless the working directory is inside the root they
 * would write to.
 */

/** Whether `cwd` sits inside `root`. */
export function isInsideRoot(root: string, cwd: string): boolean {
  const rel = relative(resolve(root), resolve(cwd))
  // Empty means the same directory. A leading `..` means cwd is outside, and an
  // absolute result means the two share no common root at all (different drive
  // on Windows).
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Whether `root` looks like the Stacks framework repository. */
export function looksLikeFrameworkRepo(root: string): boolean {
  return existsSync(resolve(root, 'storage/framework/core/buddy'))
}

/**
 * Stop unless this is the framework repository and we are standing in it.
 *
 * Throws rather than warns: the alternative is silently rewriting a file in a
 * repository the caller is not looking at.
 */
export function assertFrameworkRepo(root: string, command: string, cwd: string = process.cwd()): void {
  if (looksLikeFrameworkRepo(root) && isInsideRoot(root, cwd))
    return

  throw new Error(
    `${command} operates on the Stacks framework repository and would write to ${root}, `
    + `which is not where you are (${cwd}). `
    + `Run it from a framework checkout; an application has no generated framework artifacts to check.`,
  )
}
