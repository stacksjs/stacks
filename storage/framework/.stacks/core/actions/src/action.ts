export class Action {
  name: string
  description: string
  handle: () => Promise<string>

  constructor({ name, description, handle }: { name: string; description: string; handle: () => Promise<string> }) {
    this.name = name
    this.description = description
    this.handle = handle
  }
}
