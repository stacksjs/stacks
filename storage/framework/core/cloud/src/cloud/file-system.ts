import type { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { aws_efs as efs, RemovalPolicy } from 'aws-cdk-lib'

export interface FileSystemStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
}

export class FileSystemStack {
  fileSystem: efs.FileSystem
  accessPoint: efs.AccessPoint

  constructor(scope: Construct, props: FileSystemStackProps) {
    this.fileSystem = new efs.FileSystem(scope, 'FileSystem', {
      fileSystemName: `${props.slug}-${props.appEnv}-efs`,
      vpc: props.vpc,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      enableAutomaticBackups: true, // TODO: ensure this is documented
      encrypted: true,
    })

    this.accessPoint = new efs.AccessPoint(scope, 'FileSystemAccessPoint', {
      fileSystem: this.fileSystem,
      path: '/',
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    })
  }
}
