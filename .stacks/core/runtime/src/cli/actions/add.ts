import { installPackage } from '@stacksjs/cli'
import type { AddOptions } from '@stacksjs/types'

export async function invoke(options: AddOptions) {
  if (options?.table)
    await addTable()

  else if (options.calendar)
    await addCalendar()
}

/**
 * An alias of the invoke method.
 * @param options
 * @returns
 */
export async function add(options: AddOptions) {
  return invoke(options)
}

export async function addTable() {
  await installPackage('@stacksjs/table')
}

export async function addCalendar() {
  await installPackage('@stacksjs/calendar')
}

export async function installPackages(names: string[]) {
  for (const name of names)
    await installPackage(name)
}
