import type { aws_ec2 as ec2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { aws_dynamodb as dynamodb, RemovalPolicy } from 'aws-cdk-lib'

export interface DatabaseStackProps extends NestedCloudProps {
  vpc: ec2.Vpc
}

export class DatabaseStack {
  database: dynamodb.Table

  constructor(scope: Construct, props: DatabaseStackProps) {
    this.database = new dynamodb.Table(scope, 'Database', {
      tableName: `${props.slug}-${props.appEnv}-database`,
      partitionKey: {
        // wip
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        // wip
        name: 'sort',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      readCapacity: 5,
      writeCapacity: 5,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    })
  }
}
