import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface DeploymentRequestType extends RequestInstance{
      validate(): void
       commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
     
    }

export class DeploymentRequest extends Request implements DeploymentRequestType  {
      public commitSha = ''
public commitMessage = ''
public branch = ''
public status = ''
public executionTime = 0
public deployScript = ''
public terminalOutput = ''

      public validate(): void {
        validateField('Deployment', this.all())
      }
    }
    
    export const deploymentRequest = new DeploymentRequest()
    