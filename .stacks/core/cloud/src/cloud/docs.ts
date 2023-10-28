import type { NestedStackProps } from 'aws-cdk-lib'
import { NestedStack } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export class DocsStack extends NestedStack {
  constructor(scope: Construct, props: NestedStackProps) {
    super(scope, 'Docs', props)
    // ...
  }
}
