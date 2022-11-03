import { installPackage as install } from '@stacksjs/cli'
import type { AddOptions, SpawnReturnValue } from '@stacksjs/types'
import { ResultAsync, err, ok } from '@stacksjs/errors'

export async function invoke(options: AddOptions) {
  if (options?.table)
    await addTable(options)

  else if (options.calendar)
    await addCalendar(options)
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function add(options: AddOptions) {
  return invoke(options)
}

export async function addTable(options: AddOptions) {
  await installPackage('@stacksjs/table', options)
  // await runCommand('', options)
}

export async function addCalendar(options: AddOptions) {
  const result = await installPackage('@stacksjs/calendar', options)
  if (result.isErr())
    return result

  // await runCommand('', options)
}

export async function installPackage(name: string, options: AddOptions): Promise<ResultAsync<SpawnReturnValue, Error>> {
  return ResultAsync.fromPromise(
    install(name, options),
    () => new Error('Package install error'),
  )
}

export async function installPackages(names: string[], options: AddOptions) {
  try {
    await install(names, options)
    return ok('installed packages')
  }
  catch (error) {
    return err(error)
  }
}
