import type { AppEnvType } from '@stacksjs/types'
import type { StackProps } from 'aws-cdk-lib'

export interface CloudOptions extends StackProps {
  name: string
  env: {
    account: string
    region: string
  }
  slug: string
  appEnv: AppEnvType
  appName: string
  domain: string
  timestamp: string
}

export interface NestedCloudProps {
  name: string
  env: {
    account: string
    region: string
  }
  slug: string
  appEnv: AppEnvType
  appName: string
  domain: string
  timestamp: string
}
