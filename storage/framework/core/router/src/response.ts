import type { ResponseInstance } from '@stacksjs/types'

interface ResponseData {
  status: number
  headers: { [key: string]: string }
  body: string
}

class Response {
  static json(data: any, status: number = 200): ResponseData {
    return {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  }

  static success(data: any): ResponseData {
    return this.json(data, 200)
  }

  static created(data: any): ResponseData {
    return this.json(data, 201)
  }

  static noContent(): ResponseData {
    return {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }
  }

  static error(message: string, statusCode: number = 500): ResponseData {
    return this.json({ error: message }, statusCode)
  }

  static forbidden(message: string): ResponseData {
    return this.error(message, 403)
  }

  static notFound(message: string): ResponseData {
    return this.error(message, 404)
  }
}

export const response: ResponseInstance = Response
