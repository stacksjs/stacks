import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import type { DeploymentRequestType } from '../types/requests'

export class DeploymentRequest extends Request implements DeploymentRequestType {
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
  public deleted_at = ''

  public async validate(): Promise<void> {
    await validateField('Deployment', this.all())
  }
}

export const deploymentRequest = new DeploymentRequest()
