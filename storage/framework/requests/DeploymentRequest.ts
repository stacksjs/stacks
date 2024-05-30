import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface DeploymentRequestType extends RequestInstance{
      validate(params: any): void
    }

export class DeploymentRequest extends Request implements DeploymentRequestType  {
      
      public validate(params: any): void {
        validateField('Deployment', this.all())
      }
    }
    
    export const deploymentRequest = new DeploymentRequest()
    