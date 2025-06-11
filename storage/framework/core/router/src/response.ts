import type { ResponseInstance } from '@stacksjs/types'

interface ResponseData {
  status: number
  headers: { [key: string]: string }
  body: string
}

export class Response implements ResponseInstance {
  public json(data: any, statusCode: number = 200): ResponseData {
    const isErrorStatus = statusCode >= 400
    return {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isErrorStatus ? { errors: data } : { data }),
    }
  }

  public success(data: any): ResponseData {
    return this.json(data, 200)
  }

  public created(data: any): ResponseData {
    return this.json(data, 201)
  }

  public noContent(): ResponseData {
    return {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }
  }

  public error(message: string, statusCode: number = 500): ResponseData {
    return this.json({ error: message }, statusCode)
  }

  public forbidden(message: string): ResponseData {
    return this.error(message, 403)
  }

  public unauthorized(message: string): ResponseData {
    return this.error(message, 401)
  }

  public notFound(message: string): ResponseData {
    return this.error(message, 404)
  }
}

export const response: Response = new Response()
