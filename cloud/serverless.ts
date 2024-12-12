import type { Construct } from 'constructs'
import type { CloudOptions } from '../types'
import {
  AiStack,
  CdnStack,
  CliStack,
  ComputeStack,
  DeploymentStack,
  DnsStack,
  DocsStack,
  EmailStack,
  FileSystemStack,
  JumpBoxStack,
  NetworkStack,
  PermissionsStack,
  QueueStack,
  RedirectsStack,
  SecurityStack,
  StorageStack,
} from '@stacksjs/cloud'
import { config } from '@stacksjs/config'
import { Stack } from 'aws-cdk-lib'

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
  api!: ComputeStack
  cdn!: CdnStack
  queue!: QueueStack
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

  async init() {
    if (config.api?.deploy) {
      const props = this.props
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

      this.cdn = new CdnStack(this, {
        ...props,
        publicBucket: this.storage.publicBucket,
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
        appBucket: this.storage.publicBucket,
        docsBucket: this.storage.docsBucket,
        mainDistribution: this.cdn.mainDistribution,
        docsDistribution: this.cdn.docsDistribution,
      })
    }
  }
}
