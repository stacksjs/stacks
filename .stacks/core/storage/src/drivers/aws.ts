import { type NestedStackProps } from 'aws-cdk-lib'
import { NestedStack, aws_s3 as s3 } from 'aws-cdk-lib'
import { type Construct } from 'constructs'
import { storage } from '@stacksjs/config'

export class StorageStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props)

    if (!storage.name)
      throw new Error('./config storage.name is not defined')

    // eslint-disable-next-line no-new
    new s3.Bucket(this, storage.name)
  }
}
