import type { AddOptions } from '@stacksjs/types'
import { installPackage } from '@stacksjs/cli'

export async function invoke(options: AddOptions): Promise<void> {
  if (options?.table)
    await addTable()

  if (options?.calendar)
    await addCalendar()
}

export async function add(options: AddOptions): Promise<void> {
  return await invoke(options)
}

export async function addTable(): Promise<void> {
  await installPackage('@stacksjs/table')
}

export async function addCalendar(): Promise<void> {
  await installPackage('@stacksjs/calendar')
}

export async function installPackages(names: string[]): Promise<void> {
  for (const name of names) await installPackage(name)
}
