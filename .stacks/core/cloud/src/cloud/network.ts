import { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface NetworkStackProps extends NestedCloudProps {
  //
}

export class NetworkStack {
  vpc: ec2.Vpc

  constructor(scope: Construct, props: NetworkStackProps) {
    this.vpc = new ec2.Vpc(scope, 'Network', {
      vpcName: `${props.appName}-${props.appEnv}-vpc`,
      // ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
    // subnetConfiguration: [
    //   {
    //     cidrMask: 19, // Size of the subnet in CIDR notation
    //     name: `${this.appName}-${appEnv}-public-subnet-1`,
    //     subnetType: ec2.SubnetType.PUBLIC,
    //   },
    //   {
    //     cidrMask: 19,
    //     name: `${this.appName}-${appEnv}-public-subnet-2`,
    //     subnetType: ec2.SubnetType.PUBLIC,
    //   },
    //   {
    //     cidrMask: 19,
    //     name: `${this.appName}-${appEnv}-private-subnet-1`,
    //     subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //   },
    //   {
    //     cidrMask: 19,
    //     name: `${this.appName}-${appEnv}-private-subnet-2`,
    //     subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //   },
    // ],
    })
  }
}
