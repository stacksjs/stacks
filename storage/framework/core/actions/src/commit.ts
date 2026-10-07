import type { CleanOptions } from '@stacksjs/types'
import process from 'node:process'
import { NpmScript } from '@stacksjs/enums'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { runNpmScript } from '@stacksjs/utils'

export async function invoke(options: CleanOptions): Promise<void> {
  log.info('Committing...')

  const result = await runNpmScript(NpmScript.Commit, { cwd: projectPath(), ...options })

  // `runNpmScript` reports a missing script by returning an `err`, not by
  // throwing, so this fell straight through to the success line below:
  // `buddy commit` printed "The commit script does not exist in the
  // package.json file." and then "Committed", and exited 0. A caller chaining
  // on it (`buddy commit && git push`) pushed whatever was already there,
  // having been told a commit had been made.
  //
  // Nothing was committed, so say so and leave non-zero. `buddy commit` does
  // not work at all today, for a reason that is not this function's to fix:
  // see stacksjs/stacks#2877.
  if (result.isErr) {
    // `runNpmScript` already reported the cause on its way to building the
    // `err`, so this says what it means for the caller rather than printing
    // the same line twice. Awaited, because `log.error` is async and
    // `process.exit` does not wait for it.
    await log.error('Nothing was committed.')
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  log.success('Committed')
}

export async function commit(options: CleanOptions): Promise<void> {
  return await invoke(options)
}
