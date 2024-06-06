import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface DeploymentRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'commitSha' |'commitMessage' |'branch' |'status' |'executionTime' |'deployScript' |'terminalOutput'): number | string | null
       id: number
 commitSha: string
      commitMessage: string
      branch: string
      status: string
      executionTime: number
      deployScript: string
      terminalOutput: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class DeploymentRequest extends Request implements DeploymentRequestType  {
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
    