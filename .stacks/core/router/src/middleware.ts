export interface MiddlewareType {
  name: string
  priority: number
  handle: Function
}
  
export class Middleware implements MiddlewareType {
  name: string
  priority: number
  handle: Function

  constructor(data: MiddlewareType) {
      this.name = data.name
      this.priority = data.priority
      this.handle = data.handle
  }
}
