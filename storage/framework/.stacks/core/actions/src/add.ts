import { installPackage } from 'stacks:cli'
import type { AddOptions } from 'stacks:types'

export async function invoke(options: AddOptions) {
  if (options?.table)
    await addTable()

  if (options?.calendar)
    await addCalendar()
}

export async function add(options: AddOptions) {
  return invoke(options)
}

export async function addTable() {
  await installPackage('stacks:table')
}

export async function addCalendar() {
  await installPackage('stacks:calendar')
}

export async function installPackages(names: string[]) {
  for (const name of names)
    await installPackage(name)
}
