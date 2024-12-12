import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { CfnOutput as Output } from 'aws-cdk-lib'

export interface CliStackProps extends NestedCloudProps {}

export class CliStack {
  constructor(scope: Construct, props: CliStackProps) {
    new Output(scope, 'CliSetupUrl', {
      value: `https://api.${props.domain}/install`,
      description: 'URL to trigger the CLI setup function',
    })
  }
}
