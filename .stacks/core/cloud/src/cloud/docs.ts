/* eslint-disable no-new */
import {
  NestedStack,
  CfnOutput as Output,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { config } from '@stacksjs/config'
import type { NestedCloudProps } from '../types'

export class DocsStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Docs', props)
    // if docsPrefix is not set, then we know we are in docsMode and the documentation lives at the root of the domain
    const docsPrefix = config.app.docMode ? undefined : config.docs.base
    const docsSource = '../../../storage/framework/docs'

    new Output(this, 'DocsUrl', {
      value: `https://${props.domain}/${docsPrefix}`,
      description: 'The URL of the deployed documentation',
    })
  }
}
