export class Action {
  name: string
  description: string
  longRunning: boolean
  handle: () => Promise<string>

  constructor({ name, description, handle }: { name: string, description: string, handle: () => Promise<string> }) {
    this.name = name
    this.description = description
    this.longRunning = false // TODO: Implement long running actions
    this.handle = handle
  }
}
