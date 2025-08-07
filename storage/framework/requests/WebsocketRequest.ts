import type { schema } from '@stacksjs/validation'
import type { WebsocketRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataWebsocket {
  id: number
  type: string[] | string
  socket: string
  details: string
  time: number
  created_at?: string
  updated_at?: string
}
export class WebsocketRequest extends Request<RequestDataWebsocket> implements WebsocketRequestType {
  public id = 1
  public type = []
  public socket = ''
  public details = ''
  public time = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Websocket', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const websocketRequest = new WebsocketRequest()
