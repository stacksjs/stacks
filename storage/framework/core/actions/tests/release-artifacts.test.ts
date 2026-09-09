import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * `bump.ts` runs its release on import, so these read it as source rather than
 * calling into it.
 */
describe('framework release artifact staging', () => {
  const source = (): string => readFileSync(resolve(__dirname, '../src/bump.ts'), 'utf8')

  test('never stages dependency or scratch manifests outside storage/framework', () => {
    expect(source()).toContain("':(glob)storage/framework/**/package.json'")
    expect(source()).not.toContain("':(glob)**/package.json'")
  })

  /**
   * A pathspec that matches nothing is fatal to `git add` (exit 128), and a
   * consumer app has no manifests under `storage/framework` — so staging that
   * glob unconditionally aborted every consumer release *after* the bump had
   * already rewritten package.json, CHANGELOG.md and bun.lock, leaving the
   * release half-applied and untagged.
   */
  test('stages the vendored core manifests only for a framework release', () => {
    const staging = source().slice(source().indexOf('async function stageReleaseArtifacts'))

    expect(staging).toMatch(
      /const pathspecs = isFrameworkRelease\s*\?\s*\[':\(glob\)storage\/framework\/\*\*\/package\.json', 'package\.json'\]\s*:\s*\['package\.json'\]/,
    )
  })

  test('preserves the canonical lockfile format during a release', () => {
    expect(source()).toContain("const expectedLockfileVersion = lockfileVersion(previousLock.toString('utf8'))")
    expect(source()).not.toContain('const expectedLockfileVersion = 1')
    expect(source()).toContain("repository's declared Bun toolchain")
  })

  test('refreshes and stages the Pantry lockfile without lifecycle scripts', () => {
    expect(source()).toContain("['pantry', 'install', '--ignore-scripts', '--quiet']")
    expect(source()).toContain("for (const file of ['CHANGELOG.md', 'bun.lock', 'pantry.lock'])")
  })

  /**
   * An app that provisions system dependencies per machine gitignores
   * `pantry.lock`. Staging it because it exists on disk aborted the release
   * after the bump had already written every artifact.
   */
  test('skips an optional lockfile a .gitignore rule covers', () => {
    const staging = source().slice(source().indexOf('async function stageReleaseArtifacts'))

    expect(staging).toContain('if (await isGitIgnored(file))')
    expect(source()).toContain("git(['check-ignore', '--', file], p.projectPath(), { throwOnError: false })")
  })

  /**
   * The premise the skip rests on: `git add` treats an ignored path as an
   * error, not as nothing to do. If that ever stopped being true the filter
   * would be dead weight rather than load-bearing.
   */
  test('git add on an ignored path fails rather than staging nothing', () => {
    const repo = mkdtempSync(join(tmpdir(), 'stacks-release-ignored-'))

    try {
      const run = (...args: string[]): { exitCode: number | null } =>
        Bun.spawnSync(['git', ...args], { cwd: repo, stdout: 'pipe', stderr: 'pipe' })

      run('init', '--quiet')
      writeFileSync(join(repo, '.gitignore'), 'pantry.lock\n')
      writeFileSync(join(repo, 'package.json'), '{}\n')
      writeFileSync(join(repo, 'pantry.lock'), '{}\n')

      expect(run('add', '--', 'package.json', 'pantry.lock').exitCode).not.toBe(0)
      expect(run('add', '--', 'package.json').exitCode).toBe(0)

      const ignored = Bun.spawnSync(['git', 'check-ignore', '--', 'pantry.lock'], { cwd: repo, stdout: 'pipe', stderr: 'pipe' })
      expect(ignored.stdout.toString().trim()).toBe('pantry.lock')
    }
    finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  /**
   * The two ways the lockfile format can disagree need opposite remedies, and
   * naming the operator's Bun for both sent them round a loop they could not
   * leave: re-running under the declared toolchain is what produced the newer
   * format in the first place.
   */
  test('names the stale side when the lockfile format disagrees', () => {
    // Match the comparison, not the whole guard chain. Pinning the exact
    // expression turned a later null-hardening of the same line into a CI
    // failure, which is the opposite of what this test is for.
    expect(source()).toMatch(/producedVersion != null &&[\s\S]{0,80}producedVersion > expectedLockfileVersion/)
    expect(source()).toContain('the committed lockfile predates the Bun this repository declares')
    expect(source()).toContain("this machine's Bun is older than the one that wrote the committed lockfile")
  })

  /**
   * The guard above can only work if its baseline predates every step that can
   * rewrite a lockfile.
   *
   * `refreshPantryLock()` runs `pantry install`, which reaches for Bun and
   * rewrites bun.lock once `pinLockstepDeps` has changed the manifests. While
   * the baseline was read after that call, a machine whose Bun predates the
   * committed format produced the same downgraded version on both sides of the
   * comparison - so the guard passed on exactly the lockfile it exists to
   * reject. v0.74.33 committed a v1 lockfile into a repository that requires
   * v2, and CI failed on the release commit.
   */
  test('captures the lockfile baseline before anything can rewrite it', () => {
    const src = source()
    const captured = src.indexOf('const committedBunLock')
    const pantryRefresh = src.indexOf('await refreshPantryLock()')
    const regenerated = src.indexOf("['bun', 'install', '--lockfile-only']")

    expect(captured).toBeGreaterThan(-1)
    expect(pantryRefresh).toBeGreaterThan(-1)
    expect(captured).toBeLessThan(pantryRefresh)
    expect(captured).toBeLessThan(regenerated)

    // The comparison must read that pre-refresh capture, not the working tree.
    expect(src).toContain('const previousLock = committedBunLock')
  })

  /**
   * An aborted release has to leave the lockfiles exactly as it found them.
   * Only bun.lock was restored before, so a release that stopped after the
   * Pantry refresh left a rewritten pantry.lock behind - and on a machine that
   * cannot download the pinned toolchain, that rewrite silently drops the
   * `bun.sh` pin from it.
   */
  test('every abort path restores both committed lockfiles', () => {
    const src = source()

    expect(src).toContain('function restoreCommittedLockfiles()')
    expect(src).toContain('writeFileSync(bunLockPath, committedBunLock)')
    expect(src).toContain('writeFileSync(pantryLockPath, committedPantryLock)')

    // All three aborts inside the lockfile block: a failed regeneration, a
    // regeneration that wrote nothing, and a format mismatch.
    const block = src.slice(src.indexOf('const committedBunLock'))
    expect(block.split('restoreCommittedLockfiles()').length - 1).toBeGreaterThanOrEqual(4)

    // And none of them may fall back to the single-file restore this replaced.
    // Scoped to this block: refreshPantryLock keeps its own local restore for
    // its own failure, which is correct and unrelated.
    expect(block).not.toContain('writeFileSync(lockPath, previousLock)')
  })
})
