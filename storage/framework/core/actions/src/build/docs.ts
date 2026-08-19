import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

/**
 * Build the documentation site.
 *
 * **The entry point is resolved, not looked up on `$PATH`.** This ran
 * `bunpress build` and depended on a bare binary name being findable, which is
 * true on a developer's shell (`node_modules/.bin` is on it) and false in the
 * two places that matter:
 *
 * - A deploy's `preStart` runs with a minimal environment, so the step died
 *   with `Executable not found in $PATH: "bunpress"` and left no `dist/` at
 *   all. The app then started normally and every documentation URL answered
 *   with the view's own "the documentation has not been built" notice, which
 *   reads as a missing build rather than a broken deploy step. reviewos.org
 *   works around it by naming the entry point itself in `config/cloud.ts`.
 * - A machine with a global `bunpress` on `$PATH` - anyone with a bunpress
 *   checkout linked - builds the docs with *that* copy rather than the one the
 *   project depends on, so a fix taken as a dependency appears not to work.
 *
 * Resolving from the project cannot pick the wrong copy and needs nothing of
 * the shell. The bare name stays as the last resort, for a project that has
 * bunpress installed globally and not as a dependency.
 */
function bunpressCommand(): string {
  try {
    // Through `package.json` and its `bin`, not the built path directly: the
    // package's `exports` map does not publish `dist/bin/cli.js` as a subpath,
    // so resolving it by name fails even though the file is right there.
    const manifest = Bun.resolveSync('@stacksjs/bunpress/package.json', projectPath())
    const pkg = require(manifest) as { bin?: string | Record<string, string> }
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.bunpress

    if (!bin)
      return 'bunpress'

    return `bun ${manifest.slice(0, manifest.lastIndexOf('/'))}/${bin.replace(/^\.\//, '')}`
  }
  catch {
    return 'bunpress'
  }
}

await runCommand(`${bunpressCommand()} build`, {
  cwd: projectPath(),
})
