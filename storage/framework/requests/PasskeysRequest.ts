import type { schema } from '@stacksjs/validation'
import type { PasskeysRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPasskeys {
  id: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports: string
  created_at: string
  updated_at: string
  last_used_at: string

}
export class PasskeysRequest extends Request<RequestDataPasskeys> implements PasskeysRequestType {
  public id = 0
  public cred_public_key = ''
  public user_id = 0
  public webauthn_user_id = ''
  public counter = 0
  public credential_type = ''
  public device_type = ''
  public backup_eligible = false
  public backup_status = false
  public transports = ''
  public created_at = ''
  public updated_at = ''
  public last_used_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Passkeys', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const passkeysRequest = new PasskeysRequest()
