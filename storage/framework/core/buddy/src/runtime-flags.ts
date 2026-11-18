/**
 * How the published `buddy` executable starts Bun.
 *
 * Bun reads `bunfig.toml` from the directory it starts in and runs that file's
 * preloads before the first line of the CLI. For a `buddy` installed once for
 * the machine, that directory is wherever it was typed: inside a project, Bun
 * ran the project's env plugin and preloader in a process that only decides
 * which `buddy` should run the command and then hands over to it, and the
 * process it hands to does all of that again. In a project with nothing
 * installed it was worse. The preloads named packages that are not there, Bun
 * auto-installed them from the network at whatever version it picked, and a
 * trivial command took five seconds before buddy's own code ran.
 *
 * So the executable starts Bun with no config file and no auto-install: its
 * own dependencies are installed beside it, and the project's config belongs
 * to the process started in the project. When the CLI turns out to be the
 * project's own after all (`node_modules/.bin/buddy` in an npm script), the
 * launcher restarts it in the root without these flags, under the project's
 * config.
 *
 * No imports: the build reads this too.
 */
export const ISOLATED_RUNTIME_FLAGS = ['--config=/dev/null', '--no-install'] as const

/** `env -S` splits the line into arguments, on macOS and on Linux alike. */
export const CLI_SHEBANG = `#!/usr/bin/env -S bun ${ISOLATED_RUNTIME_FLAGS.join(' ')}`

/** Whether this process was started the way the executable starts it. */
export function isIsolatedRuntime(execArgv: readonly string[]): boolean {
  return ISOLATED_RUNTIME_FLAGS.every(flag => execArgv.includes(flag))
}

/** `execArgv` for a restart that should read the project's config again. */
export function withoutIsolation(execArgv: readonly string[]): string[] {
  return execArgv.filter(flag => !(ISOLATED_RUNTIME_FLAGS as readonly string[]).includes(flag))
}
