import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { aws_ec2 as ec2 } from 'aws-cdk-lib'

export interface NetworkStackProps extends NestedCloudProps {
  //
}

export class NetworkStack {
  vpc: ec2.Vpc

  constructor(scope: Construct, props: NetworkStackProps) {
    this.vpc = new ec2.Vpc(scope, 'Network', {
      vpcName: `${props.slug}-${props.appEnv}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private-subnet-1',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28,
        },
      ],
    })
  }
}
