import { Glob } from 'bun'
import { existsSync } from 'node:fs'

/**
 * The `.ts` files an app keeps in `resources/functions`, or none.
 *
 * An app with no functions of its own is normal - `buddy new --minimal`
 * leaves the folder empty, and git does not keep an empty folder - but
 * `Glob.scan` throws ENOENT on a missing `cwd`. Unguarded, that aborted the
 * preload for every command in a fresh checkout: CI's `buddy key:generate`
 * died with a bare "no such file or directory, open .../resources/functions"
 * and no stack, while the same app ran fine on the laptop that still had the
 * empty folder. The model, job and controller scans below were already
 * wrapped; this one was not.
 */
export async function* userFunctionFiles(dir: string): AsyncGenerator<string> {
  if (!existsSync(dir))
    return
  for await (const file of new Glob('**/*.ts').scan({ cwd: dir, absolute: true, onlyFiles: true })) {
    if (!file.endsWith('.d.ts'))
      yield file
  }
}
