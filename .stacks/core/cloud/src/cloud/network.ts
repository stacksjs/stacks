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
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-public-subnet-1`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-public-subnet-2`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-public-subnet-3`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-private-subnet-1`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-private-subnet-2`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 21,
          name: `${props.appName}-${props.appEnv}-private-subnet-3`,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    })
  }
}