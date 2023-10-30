/* eslint-disable no-new */
import type { Construct } from 'constructs'
import { Stack } from 'aws-cdk-lib'
import type { CloudOptions } from '../types'
import { CdnStack } from './cdn'
import { DnsStack } from './dns'
import { DocsStack } from './docs'
import { StorageStack } from './storage'
import { SecurityStack } from './security'
import { DeploymentStack } from './deployment'

export class Cloud extends Stack {
  constructor(scope: Construct, id: string, props: CloudOptions) {
    super(scope, id, props)

    // please beware: be careful changing the order of the stack creations below
    const dns = new DnsStack(this, props)

    const security = new SecurityStack(this, {
      ...props,
      zone: dns.zone,
    })

    const storage = new StorageStack(this, {
      ...props,
      kmsKey: security.kmsKey,
    })

    const docs = new DocsStack(this, props)

    const cdn = new CdnStack(this, {
      ...props,
      publicBucket: storage.publicBucket,
      logBucket: storage.logBucket,
      certificate: security.certificate,
      zone: dns.zone,
      firewall: security.firewall,
      originRequestFunction: docs.originRequestFunction,
    })

    new DeploymentStack(this, {
      ...props,
      publicBucket: storage.publicBucket,
      privateBucket: storage.privateBucket,
      cdn: cdn.distribution,
    })

    // security.addDependency(dns)
    // storage.addDependency(security)
    // cdn.addDependency(storage)
    // cdn.addDependency(dns)
    // cdn.addDependency(security)
  }
}
