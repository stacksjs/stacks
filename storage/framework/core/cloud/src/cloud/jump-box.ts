import type { aws_efs as efs } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { aws_ec2 as ec2, aws_iam as iam, CfnOutput as Output } from 'aws-cdk-lib'

export interface JumpBoxStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
  fileSystem: efs.FileSystem
}

// export class DocsStack extends NestedStack {
export class JumpBoxStack {
  jumpBox?: ec2.Instance

  constructor(scope: Construct, props: JumpBoxStackProps) {
    const role = new iam.Role(scope, 'JumpBoxInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    })

    // this instance needs to be created once to mount the EFS & clone the Stacks repo
    this.jumpBox = new ec2.Instance(scope, 'JumpBox', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      role,
      userData: ec2.UserData.custom(`
      #!/bin/bash
      yum update -y
      yum install -y amazon-efs-utils
      yum install -y git
      yum install -y https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/linux_amd64/amazon-ssm-agent.rpm
      mkdir /mnt/efs
      mount -t efs ${props.fileSystem.fileSystemId}:/ /mnt/efs
      git clone https://github.com/stacksjs/stacks.git /mnt/efs
    `),
    })

    new Output(scope, 'JumpBoxInstanceId', {
      value: this.jumpBox.instanceId,
      description: 'The ID of the EC2 instance that can be used to SSH into the Stacks Cloud.',
    })
  }
}
