/**
 * Minimal CLI class implementation
 * Placeholder for @stacksjs/clapp package
 */

export interface Command {
  name: string
  description: string
  action: (...args: any[]) => void | Promise<void>
}

export class CLI {
  private commands: Map<string, Command> = new Map()
  private name: string

  constructor(name: string = 'cli') {
    this.name = name
  }

  command(name: string, description: string = ''): this {
    // Placeholder - minimal implementation
    return this
  }

  alias(alias: string): this {
    // Placeholder - minimal implementation
    return this
  }

  option(flags: string, description: string, defaultValue?: any): this {
    // Placeholder - minimal implementation
    return this
  }

  action(callback: (...args: any[]) => void | Promise<void>): this {
    // Placeholder - minimal implementation
    return this
  }

  help(): void {
    console.log(`${this.name} - CLI Help`)
  }

  version(version: string): this {
    // Placeholder - minimal implementation
    return this
  }

  parse(argv?: string[]): void {
    // Placeholder - minimal implementation
  }
}
