import type { AppEnvType } from '@stacksjs/types'

export interface CloudOptions {
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
