/* eslint-disable no-new */
import type { Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import type { StackProps } from 'aws-cdk-lib'
import { CdnStack } from './cdn'
import { DocsStack } from './docs'
import { StorageStack } from './storage'

interface EnvProps extends StackProps {
  env: {
    account: string
    region: string
  }
}

export class Stacks extends Stack {
  constructor(scope: Construct, id: string, props: EnvProps) {
    super(scope, id, props)

    // please beware: be careful changing the order of the stacks creation below
    new StorageStack(this, props)
    new CdnStack(this, props)
    new DocsStack(this, props)
  }
}
