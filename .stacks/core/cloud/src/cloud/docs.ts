import { NestedStack } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class DocsStack extends NestedStack {
  constructor(scope: Construct, props: NestedStackProps) {
    super(scope, 'Docs', props)
    // ...
  }
}
