import type { CliOptions, CommandResult } from '@stacksjs/types'

export class Command {
  name: string
  description: string
  options: object[]
  run: (options: CliOptions) => Promise<CommandResult>
  onFail: (error: Error) => void
  onSuccess: () => void

  constructor({
    name,
    description,
    options,
    run,
    onFail,
    onSuccess,
  }: {
    name: string
    description: string
    options: object[]
    run: (options: CliOptions) => Promise<CommandResult>
    onFail: (error: Error) => void
    onSuccess: () => void
  }) {
    this.name = name
    this.description = description
    this.options = options
    this.run = run
    this.onFail = onFail
    this.onSuccess = onSuccess
  }
}

export { cac as command } from 'cac'
export { execaCommand as spawn } from 'execa'
