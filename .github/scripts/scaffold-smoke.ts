/**
 * A freshly scaffolded app must typecheck against the framework it pinned.
 *
 * `buddy new` writes the template from THIS checkout and then pins the
 * framework to a PUBLISHED version. Those two can disagree: `resolvePublishedVersion`
 * falls back to the newest published release when the vendored version is not
 * on npm yet, which is the normal state of this repo between a version bump
 * and its publish. When the template references something added since that
 * release — a config field, an exported type — the scaffolded app fails
 * `./buddy typecheck` on its first run, with an error in a file the user did
 * not write.
 *
 * That has happened at least twice: `MobileConfig` in `config/mobile.ts`
 * against a framework that did not export it yet (stacksjs/stacks#2322), and
 * `security.api` in `config/security.ts` (stacksjs/stacks#2375), which this
 * script caught within minutes of the field landing.
 *
 * A red run here is not a false alarm on main. It says `buddy new` produces a
 * broken app right now, which is true until the release publishes. The fix is
 * to publish, not to relax the check.
 *
 * Deliberately runs `tsc` directly rather than `./buddy typecheck`: the action
 * wraps it in a subprocess whose failure surfaces as a stack through the CLI's
 * error handler, and the point of this job is to print the type errors.
 *
 * Run: `bun .github/scripts/scaffold-smoke.ts [--keep]`
 */

import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

async function main(): Promise<void> {
  const repoRoot = process.cwd()
  const keep = process.argv.includes('--keep')
  const workspace = await mkdtemp(join(tmpdir(), 'stacks-scaffold-smoke-'))
  const appDir = join(workspace, 'smoke-app')

  console.log(`Scaffolding into ${appDir}`)

  const scaffold = Bun.spawn(['./buddy', 'new', appDir, '--name', 'smoke-app'], {
    cwd: repoRoot,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const scaffoldCode = await scaffold.exited

  /**
   * Did the scaffold produce an app, whatever its exit status said?
   *
   * `buddy new` installs system packages through pantry as its last act, and on
   * a CI runner that step can fail for reasons that have nothing to do with the
   * template: the first run of this job died on `bun.sh@1.3.14 (FileBusy)`,
   * because the runner is already executing the Bun it was asked to install.
   * Treating that as "the scaffold is broken" would make the job red for a
   * property it does not test, which is how a check gets muted.
   *
   * So the question asked here is the one this job is actually about: is there
   * an app to typecheck? If the template failed to write, there is not, and
   * that IS a scaffold failure worth reporting.
   */
  const scaffolded = ['package.json', 'tsconfig.json', 'config'].every(entry => existsSync(join(appDir, entry)))

  if (!scaffolded) {
    console.error(`\n\`buddy new\` exited ${scaffoldCode} without producing an app, so nothing was typechecked.`)
    process.exit(1)
  }

  if (scaffoldCode !== 0)
    console.log(`\nNote: \`buddy new\` exited ${scaffoldCode}, but wrote an app — typechecking it anyway.`)

  const manifest = await Bun.file(join(appDir, 'package.json')).json()
  const pinned = manifest.dependencies?.stacks ?? manifest.devDependencies?.stacks ?? '(none)'

  // The FRAMEWORK version, not the root package.json's. The root is the
  // playground app and carries its own unrelated version, so reporting it here
  // said things like "pinned ^0.74.0; this checkout is 0.70.52" — which reads
  // as the scaffold being ahead when it is a different number entirely.
  const vendored = (await Bun.file(join(repoRoot, 'storage/framework/package.json')).json()).version

  console.log(`\nScaffold pinned stacks@${pinned}; this checkout's framework is ${vendored}.`)

  if (!existsSync(join(appDir, 'tsconfig.json'))) {
    console.error('The scaffolded app has no tsconfig.json to check.')
    process.exit(1)
  }

  const typecheck = Bun.spawn(['bun', 'x', '--bun', 'tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'], {
    cwd: appDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [out, err] = await Promise.all([
    new Response(typecheck.stdout).text(),
    new Response(typecheck.stderr).text(),
  ])
  const code = await typecheck.exited

  if (!keep)
    await rm(workspace, { recursive: true, force: true })

  if (code === 0) {
    console.log('✓ the scaffolded app typechecks against the framework version it pinned')
    return
  }

  const errors = `${out}${err}`.trim()

  console.error(`\nA freshly scaffolded app does not typecheck against stacks@${pinned}:\n`)
  console.error(errors)

  /*
   * Say what actually went wrong, at the bottom, where the reader is.
   *
   * These two hints used to print unconditionally, and the note about `buddy
   * new` exiting non-zero was a dozen lines further up. So a run whose real
   * problem was "a system package failed to install, and we typechecked a
   * half-built app anyway" presented as a version-skew problem and sent me to
   * check the registry - where nothing was wrong (stacksjs/stacks#2414).
   *
   * The version hint is worth having when it applies. It applies when the
   * errors are about resolution: a module or preload that cannot be found is
   * what an app pinned to a version older than this checkout looks like. It
   * does not apply to a type mismatch inside a file the template wrote, which
   * is a real scaffold bug and should not be explained away.
   */
  const looksLikeResolution = /cannot find module|preload not found|cannot find name|could not resolve|TS2307|TS2304/i.test(errors)

  if (scaffoldCode !== 0) {
    console.error(
      `\n\`buddy new\` exited ${scaffoldCode} before it finished, so this app may be incomplete — `
      + `the errors above can be a consequence of that rather than of the template. `
      + `Check its output at the top of this log first.\n`,
    )
  }
  else if (looksLikeResolution) {
    console.error(
      `\nEach error names a file the template wrote. If this checkout's framework (${vendored}) is ahead `
      + `of the published one, publishing is the fix — until then \`buddy new\` produces this app.\n`,
    )
  }
  else {
    console.error(
      `\nEach error names a file the template wrote, and none of them is a resolution failure — `
      + `so this is the template disagreeing with the framework it pinned, not a publishing lag.\n`,
    )
  }

  process.exit(1)
}

if (import.meta.main)
  await main()
