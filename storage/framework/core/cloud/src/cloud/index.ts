import type { Construct } from 'constructs'
import type { CloudOptions } from '../types'
import { config } from '@stacksjs/config'
import { Stack } from 'aws-cdk-lib'
import { AiStack } from './ai'
import { CdnStack } from './cdn'
import { CliStack } from './cli'
import { ComputeStack } from './compute'
import { DeploymentStack } from './deployment'
import { DnsStack } from './dns'
import { DocsStack } from './docs'
import { EmailStack } from './email'
import { FileSystemStack } from './file-system'
import { JumpBoxStack } from './jump-box'
import { NetworkStack } from './network'
import { PermissionsStack } from './permissions'
import { QueueStack } from './queue'
import { RedirectsStack } from './redirects'
import { SecurityStack } from './security'
import { StorageStack } from './storage'

// import { DashboardStack } from './dashboard'

export class Cloud extends Stack {
  dns: DnsStack
  security: SecurityStack
  storage: StorageStack
  network: NetworkStack
  fileSystem: FileSystemStack
  jumpBox: JumpBoxStack
  docs: DocsStack
  email: EmailStack
  redirects: RedirectsStack
  permissions: PermissionsStack
  ai: AiStack
  cli: CliStack
  api?: ComputeStack
  cdn!: CdnStack
  queue?: QueueStack
  deployment!: DeploymentStack
  scope: Construct
  props: CloudOptions

  constructor(scope: Construct, id: string, props: CloudOptions) {
    super(scope, id, props)
    this.scope = scope
    this.props = props

    // please beware: be careful changing the order of the stack creations below
    this.dns = new DnsStack(this, props)
    this.security = new SecurityStack(this, {
      ...props,
      zone: this.dns.zone,
    })

    this.storage = new StorageStack(this, {
      ...props,
      kmsKey: this.security.kmsKey,
      originAccessIdentity: this.security.originAccessIdentity,
    })

    this.network = new NetworkStack(this, props)

    this.fileSystem = new FileSystemStack(this, {
      ...props,
      vpc: this.network.vpc,
    })

    this.jumpBox = new JumpBoxStack(this, {
      ...props,
      vpc: this.network.vpc,
      fileSystem: this.fileSystem.fileSystem,
    })

    this.docs = new DocsStack(this, props)

    this.email = new EmailStack(this, {
      ...props,
      zone: this.dns.zone,
    })

    this.redirects = new RedirectsStack(this, props)

    this.permissions = new PermissionsStack(this)

    // new DashboardStack(this)

    this.ai = new AiStack(this, props)

    this.cli = new CliStack(this, props)
  }

  // we use an async init() method here because we need to wait for the

  async init(): Promise<void> {
    const props = this.props

    if (this.shouldDeployApi()) {
      this.api = new ComputeStack(this, {
        ...props,
        vpc: this.network.vpc,
        fileSystem: this.fileSystem.fileSystem,
        zone: this.dns.zone,
        certificate: this.security.certificate,
      })

      this.queue = new QueueStack(this, {
        ...props,
        cluster: this.api.cluster,
        taskDefinition: this.api.taskDefinition,
      })

      await this.queue.init()
    }

    this.cdn = new CdnStack(this, {
      ...props,
      publicBucket: this.storage.publicBucket,
      docsBucket: this.storage.docsBucket,
      logBucket: this.storage.logBucket,
      certificate: this.security.certificate,
      firewall: this.security.firewall,
      originRequestFunction: this.docs.originRequestFunction,
      zone: this.dns.zone,
      lb: this.api?.lb,
    })

    this.deployment = new DeploymentStack(this, {
      ...props,
      publicBucket: this.storage.publicBucket,
      privateBucket: this.storage.privateBucket,
      docsBucket: this.storage.docsBucket,
      mainDistribution: this.cdn.mainDistribution,
      docsDistribution: this.cdn.docsDistribution,
    })
  }

  shouldDeployApi(): boolean {
    return config.cloud.api?.deploy ?? false
  }
}
