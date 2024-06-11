import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { DeploymentRequestType } from '../types/requests'

export class DeploymentRequest extends Request implements DeploymentRequestType {
      public id = 1
public commitSha = ''
public commitMessage = ''
public branch = ''
public status = ''
public executionTime = 0
public deployScript = ''
public terminalOutput = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('Deployment', this.all())
      }
    }
    
    export const deploymentRequest = new DeploymentRequest()
    