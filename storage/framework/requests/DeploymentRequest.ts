import type { DeploymentRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataDeployment {
  id: number
  commit_sha: string
  commit_message: string
  branch: string
  status: string
  execution_time: number
  deploy_script: string
  terminal_output: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export class DeploymentRequest extends Request<RequestDataDeployment> implements DeploymentRequestType {
  public id = 1
  public commit_sha = ''
  public commit_message = ''
  public branch = ''
  public status = ''
  public execution_time = 0
  public deploy_script = ''
  public terminal_output = ''
  public user_id = 0
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Deployment', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new DeploymentRequest()
