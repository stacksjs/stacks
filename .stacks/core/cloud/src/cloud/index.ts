/* eslint-disable no-new */
import type { Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import type { CloudProps } from '../types'
import { CdnStack } from './cdn'
import { DocsStack } from './docs'
import { StorageStack } from './storage'
import { SecurityStack } from './security'

export class Cloud extends Stack {
  constructor(scope: Construct, id: string, props: CloudProps) {
    super(scope, id, props)

    // please beware: be careful changing the order of the stacks creation below
    new SecurityStack(this, props)
    new StorageStack(this, props)
    new CdnStack(this, props)
    new DocsStack(this, props)
  }
}
