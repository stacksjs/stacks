import type { AppEnvType } from '@stacksjs/types'
import type { StackProps } from 'aws-cdk-lib'

export interface CloudOptions extends StackProps {
  name: string
  env: {
    account: string
    region: string
  }
  appEnv: AppEnvType
  appName: string
  domain: string
  partialAppKey: string
}

// export interface NestedCloudProps extends NestedStackProps {
export interface NestedCloudProps {
  name: string
  env: {
    account: string
    region: string
  }
  appEnv: AppEnvType
  appName: string
  domain: string
  partialAppKey: string
}