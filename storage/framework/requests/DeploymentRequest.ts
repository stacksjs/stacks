import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { DeploymentRequestType } from '../types/requests'

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataDeployment {
  id?: number
  commitSha: string
  commitMessage: string
  branch: string
  status: string
  executionTime: number
  deployScript: string
  terminalOutput: string
  user_id: number
  created_at?: string
  updated_at?: string
  deleted_at?: string
}
export class DeploymentRequest extends Request<RequestDataDeployment> implements DeploymentRequestType {
  public id = 1
  public commitSha = ''
  public commitMessage = ''
  public branch = ''
  public status = ''
  public executionTime = 0
  public deployScript = ''
  public terminalOutput = ''
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Deployment', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new DeploymentRequest()
