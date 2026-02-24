import type { CloudConfig, EnvironmentType } from '@stacksjs/ts-cloud'
import type { CloudOptions } from '../types'
import { config } from '@stacksjs/config'
import { InfrastructureGenerator } from '@stacksjs/ts-cloud'

/**
 * Cloud orchestrator using ts-cloud InfrastructureGenerator.
 *
 * This replaces the previous CDK-based Stack class. Infrastructure is now
 * generated as CloudFormation templates via ts-cloud and deployed through
 * the deploy module.
 */
export class Cloud {
  private generator: InfrastructureGenerator
  private cloudConfig: CloudConfig
  props: CloudOptions

  constructor(cloudConfig: CloudConfig, props: CloudOptions) {
    this.cloudConfig = cloudConfig
    this.props = props

    const environment = (props.appEnv === 'local' ? 'development' : props.appEnv) || 'production'

    this.generator = new InfrastructureGenerator({
      config: this.cloudConfig,
      environment: environment as EnvironmentType,
    })
  }

  /**
   * Generate the CloudFormation template
   */
  generate(): string {
    return this.generator.generate().toJSON()
  }

  /**
   * Whether the API should be deployed
   */
  shouldDeployApi(): boolean {
    return config.cloud.api?.deploy ?? false
  }
}
