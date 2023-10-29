/* eslint-disable no-new */
import type { Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import type { CloudOptions } from '../types'
import { CdnStack } from './cdn'
import { DnsStack } from './dns'
import { DocsStack } from './docs'
import { StorageStack } from './storage'
import { SecurityStack } from './security'

export class Cloud extends Stack {
  constructor(scope: Construct, id: string, props: CloudOptions) {
    super(scope, id, props)

    // please beware: be careful changing the order of the stacks creation below
    new DnsStack(this, props)
    new SecurityStack(this, props)
    new StorageStack(this, props)
    new CdnStack(this, props)
    new DocsStack(this, props)
  }
}
