import { Duration, CfnOutput as Output, aws_lambda as lambda } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export interface CliStackProps extends NestedCloudProps {}

export class CliStack {
  constructor(scope: Construct, props: CliStackProps) {
    new Output(scope, 'CliSetupUrl', {
      value: `https://${props.domain}/install`,
      description: 'URL to trigger the CLI setup function',
    })
  }
}
