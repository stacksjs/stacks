import type { CloudConfig, EnvironmentType } from '@stacksjs/ts-cloud'
import { config } from '@stacksjs/config'
import {
  deployServerlessApp,
  InfrastructureGenerator,
  redeployServerlessApp,
  rollbackServerlessApp,
  runRemoteCommand,
  setMaintenance,
} from '@stacksjs/ts-cloud'
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
  private environment: EnvironmentType

  constructor(cloudConfig?: CloudConfig) {
    this.cloudConfig = cloudConfig || tsCloud as CloudConfig
    this.environment = ((config.app.env === 'local' ? 'development' : config.app.env) || 'production') as EnvironmentType

    this.generator = new InfrastructureGenerator({
      config: this.cloudConfig,
      environment: this.environment,
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
   * Whether a Vapor-style serverless application is configured for the active
   * environment (i.e. `environments.<env>.app` is set in config/cloud.ts).
   */
  hasServerlessApp(): boolean {
    return Boolean(this.cloudConfig.environments?.[this.environment]?.app)
  }

  /**
   * Deploy the serverless application (http/queue/cli Lambda functions) for the
   * active environment. Runs build hooks, packages (zip or container image),
   * deploys the CloudFormation stack, activates the functions, runs deploy hooks
   * (e.g. migrations), and performs a health check.
   */
  async deployServerless(options: { skipBuild?: boolean, skipHooks?: boolean } = {}): Promise<void> {
    await deployServerlessApp(this.cloudConfig, this.environment, {
      skipBuild: options.skipBuild,
      skipDeployHooks: options.skipHooks,
    })
  }

  /** Re-activate the last serverless build without rebuilding. */
  async redeployServerless(): Promise<void> {
    await redeployServerlessApp(this.cloudConfig, this.environment)
  }

  /** Roll the serverless application back to its previous build. */
  async rollbackServerless(): Promise<void> {
    await rollbackServerlessApp(this.cloudConfig, this.environment)
  }

  /** Toggle maintenance mode (503 + optional bypass secret) for the HTTP function. */
  async setMaintenance(enabled: boolean, bypassSecret?: string): Promise<void> {
    await setMaintenance(this.cloudConfig, this.environment, enabled, bypassSecret)
  }

  /** Run a command on the serverless CLI function (e.g. `migrate`). */
  async runCommand(command: string): Promise<string> {
    return runRemoteCommand(this.cloudConfig, this.environment, command)
  }

  /**
   * Get the cloud configuration
   */
  getConfig(): CloudConfig {
    return this.cloudConfig
  }
}

export default Cloud
