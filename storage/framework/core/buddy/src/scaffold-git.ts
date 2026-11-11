/**
 * The first commit of a generated app.
 *
 * Plain `git` through `Bun.spawnSync`, with no logging, so it can be run
 * against a temporary repository in tests.
 */

/** The subject of the commit `buddy new` leaves behind. Conventional, since the app's own gitlint hook expects it. */
export function scaffoldCommitMessage(appName: string): string {
  return `chore: scaffold ${appName} with buddy new`
}

function git(cwd: string, args: string[]): { ok: boolean, output: string } {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  return {
    ok: result.exitCode === 0,
    output: `${result.stdout.toString()}${result.stderr.toString()}`.trim(),
  }
}

/**
 * Commit everything in `root` that git does not ignore, as one commit.
 *
 * Resolves to `null` once the commit exists, or to why it does not: `root` is
 * not a repository, the repository already has a history (it is somebody's,
 * and this must not add to it), or git refused, which on a new machine means
 * no `user.name` and `user.email`.
 *
 * `--no-verify` because the hooks belong to the app's own later commits. This
 * one holds only generated files, and a lint finding in a template is not a
 * reason to leave a new app with no history at all.
 */
export function commitScaffold(root: string, appName: string): string | null {
  if (!git(root, ['rev-parse', '--git-dir']).ok)
    return 'not a git repository'

  if (git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).ok)
    return 'the repository already has commits'

  const staged = git(root, ['add', '--all'])
  if (!staged.ok)
    return staged.output || 'git add failed'

  const committed = git(root, ['commit', '--no-verify', '--quiet', '-m', scaffoldCommitMessage(appName)])
  if (!committed.ok)
    return firstLine(committed.output) || 'git commit failed'

  return null
}

function firstLine(text: string): string {
  return text.split('\n').find(line => line.trim().length > 0)?.trim() ?? ''
}
