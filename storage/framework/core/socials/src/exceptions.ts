export class InvalidStateException extends Error {
  constructor(message: string = 'Invalid state') {
    super(message)
    this.name = 'InvalidStateException'
  }
}

export class ConfigException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigException'
  }
}
