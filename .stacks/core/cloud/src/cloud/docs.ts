import type { NestedStackProps } from 'aws-cdk-lib'
import { NestedStack } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

interface ResourceNestedStackProps extends NestedStackProps {
  env: {
    account: string
    region: string
  }
}

export class DocsStack extends NestedStack {
  constructor(scope: Construct, props: ResourceNestedStackProps) {
    super(scope, 'Docs', props)
    // ...
  }
}
