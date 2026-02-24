import type { CloudConfig } from '@stacksjs/ts-cloud'
import { config } from '@stacksjs/config'
import { InfrastructureGenerator } from '@stacksjs/ts-cloud'
import { tsCloud } from '~/config/cloud'

/**
 * Stacks Cloud (Serverless Mode)
 *
 * This file configures the serverless deployment for your Stacks application.
 * It uses ts-cloud to generate and manage AWS CloudFormation infrastructure.
 *
 * The infrastructure includes:
 * - DNS (Route53 hosted zone & records)
 * - SSL/TLS (ACM certificates)
 * - Storage (S3 buckets for frontend, docs, logs, assets)
 * - Network (VPC, subnets, security groups - when deploying containers)
 * - Compute (ECS Fargate containers for the API)
 * - CDN (CloudFront distributions)
 * - Email (SES configuration)
 * - Queue (SQS for background jobs)
 * - Load Balancer (ALB for API traffic)
 *
 * Customize by editing config/cloud.ts (the tsCloud config object).
 *
 * @see https://github.com/stacksjs/ts-cloud
 */
export class Cloud {
  private generator: InfrastructureGenerator
  private cloudConfig: CloudConfig

  constructor(cloudConfig?: CloudConfig) {
    this.cloudConfig = cloudConfig || tsCloud as CloudConfig
    const environment = (config.app.env === 'local' ? 'development' : config.app.env) || 'production'

    this.generator = new InfrastructureGenerator({
      config: this.cloudConfig,
      environment: environment as any,
    })
  }

  /**
   * Generate the CloudFormation template for the current configuration
   */
  generate(): string {
    return this.generator.generate().toJSON()
  }

  /**
   * Whether the API should be deployed (ECS Fargate containers)
   */
  shouldDeployApi(): boolean {
    return config.cloud.api?.deploy ?? false
  }

  /**
   * Get the cloud configuration
   */
  getConfig(): CloudConfig {
    return this.cloudConfig
  }
}

export default Cloud
