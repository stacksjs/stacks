export class ModelNotFoundException extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ModelNotFoundException'
  }
}
