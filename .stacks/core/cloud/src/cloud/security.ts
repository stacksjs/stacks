// waf and encryption
import { NestedStack } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class SecurityStack extends NestedStack {
  constructor(scope: Construct, props: NestedStackProps) {
    super(scope, 'Security', props)
    // ...
  }
}
