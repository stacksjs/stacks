import { installPackage } from '@stacksjs/cli'
import type { AddOptions } from '@stacksjs/types'

export async function invoke(options: AddOptions) {
  if (options?.table) await addTable()

  if (options?.calendar) await addCalendar()
}

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
  for (const name of names) await installPackage(name)
}
