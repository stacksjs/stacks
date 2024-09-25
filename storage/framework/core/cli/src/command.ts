import type { Result } from '@stacksjs/error-handling'
import type { CliOptions, Readable, Subprocess, Writable } from '@stacksjs/types'
import { runCommand } from './run'

type CommandOptionTuple = [string, string, { default: boolean }]
interface CommandOptionObject {
  name: string
  description: string
  default: boolean | string
}
type CommandOptions = CommandOptionTuple | CommandOptionObject[]
interface Options {
  name: string
  description: string
  active: boolean
  options: CommandOptions
  run: (options?: CliOptions) => Promise<any>
  onFail: (error: Error) => void
  onSuccess: () => void
}

export class Command {
  name: Options['name']
  description: Options['description']
  options: Options['options']
  run: Options['run']
  onFail: Options['onFail']
  onSuccess: Options['onSuccess']

  constructor({ name, description, options, run, onFail, onSuccess }: Options) {
    this.name = name
    this.description = description
    this.options = options
    this.run = run
    this.onFail = onFail
    this.onSuccess = onSuccess
  }
}

export const command = {
  run: async (
    command: string,
    options?: CliOptions,
  ): Promise<Result<Subprocess<Writable, Readable, Readable>, Error>> => {
    return await runCommand(command, options)
  },

  runSync: async (
    command: string,
    options?: CliOptions,
  ): Promise<Result<Subprocess<Writable, Readable, Readable>, Error>> => {
    return await runCommand(command, options)
  },
}
