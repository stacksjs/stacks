/**
 * Frontend Deployment Module
 *
 * Handles deployment of frontend applications to AWS using ts-cloud.
 * Replaces aws-cli and aws-sdk with native TypeScript implementation.
 */

import { S3Client } from 'ts-cloud/src/aws/s3'
import { CloudFrontClient } from 'ts-cloud/src/aws/cloudfront'
import { CloudFormationClient } from 'ts-cloud/src/aws/cloudformation'
import { InfrastructureGenerator } from 'ts-cloud/src/generators/infrastructure'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CloudConfig } from '@ts-cloud/types'

// Import tsCloud config from Stacks config system
import { tsCloud as config } from '~/config/cloud'

export interface DeployOptions {
  environment: string
  region: string
  buildDir?: string
  bucket?: string
  distribution?: string
}

/**
 * Deploy frontend application to S3 and CloudFront
 */
export async function deployFrontend(options: DeployOptions): Promise<void> {
  const {
    environment,
    region,
    buildDir = 'dist',
    bucket,
    distribution,
  } = options

  console.log('📦 Loading configuration...')

  // Use bunfig-loaded config
  const cloudConfig = config as CloudConfig
  const envConfig = cloudConfig.environments?.[environment]

  if (!envConfig) {
    throw new Error(`Environment "${environment}" not found in cloud.config.ts`)
  }

  // Determine build directory
  const projectRoot = process.cwd()
  const buildPath = join(projectRoot, buildDir)

  if (!existsSync(buildPath)) {
    throw new Error(`Build directory not found: ${buildPath}. Please build your frontend first.`)
  }

  console.log(`   Build directory: ${buildPath}`)

  // Initialize AWS clients
  const s3 = new S3Client(region)
  const cloudfront = new CloudFrontClient()

  // Determine bucket name
  const bucketName = bucket || Object.entries(cloudConfig.infrastructure?.storage || {}).find(([_, b]) => b.website)?.[0]
  if (!bucketName) {
    throw new Error('No S3 bucket specified. Either pass --bucket or configure a website bucket in cloud.config.ts')
  }

  const fullBucketName = `${cloudConfig.project.slug}-${environment}-${bucketName}`

  console.log(`\n📤 Uploading to S3...`)
  console.log(`   Bucket: ${fullBucketName}`)

  // Check if bucket exists
  const bucketExists = await s3.bucketExists(fullBucketName)
  if (!bucketExists) {
    console.log(`   ⚠️  Bucket does not exist. You may need to deploy infrastructure first.`)
    throw new Error(`Bucket ${fullBucketName} does not exist`)
  }

  // Sync build directory to S3
  await s3.sync({
    source: buildPath,
    bucket: fullBucketName,
    acl: 'public-read',
    cacheControl: 'public, max-age=31536000, immutable',
    delete: true, // Delete files not in source
  })

  console.log(`   ✅ Files uploaded successfully`)

  // Invalidate CloudFront cache if distribution is configured
  if (cloudConfig.infrastructure?.cdn && Object.keys(cloudConfig.infrastructure.cdn).length > 0) {
    console.log(`\n🔄 Invalidating CloudFront cache...`)

    try {
      const distributionId = distribution || await findDistribution(cloudfront, fullBucketName)

      if (distributionId) {
        await cloudfront.createInvalidation({
          distributionId,
          paths: ['/*'],
        })
        console.log(`   ✅ Cache invalidated`)
      } else {
        console.log(`   ⚠️  No CloudFront distribution found`)
      }
    } catch (error) {
      console.warn(`   ⚠️  CloudFront invalidation skipped:`, error)
    }
  }

  console.log(`\n🎉 Frontend deployed successfully!`)

  // Show deployment URL
  const cdnConfig = cloudConfig.infrastructure?.cdn ? Object.values(cloudConfig.infrastructure.cdn)[0] : null
  if (cdnConfig) {
    console.log(`   URL: https://${cdnConfig.customDomain || fullBucketName}`)
  } else {
    console.log(`   Bucket: https://${fullBucketName}.s3.${region}.amazonaws.com/index.html`)
  }
}

/**
 * Find CloudFront distribution for a bucket
 */
async function findDistribution(cloudfront: CloudFrontClient, bucketName: string): Promise<string | null> {
  try {
    const distributions = await cloudfront.listDistributions()

    // Find distribution with matching S3 origin
    // Note: CloudFront distribution origins would contain the bucket domain name
    const distribution = distributions.find(dist =>
      dist.DomainName?.includes(bucketName)
    )

    return distribution?.Id || null
  } catch {
    return null
  }
}

/**
 * Build frontend before deployment
 */
export async function buildFrontend(buildCommand: string = 'bun run build'): Promise<void> {
  console.log('🔨 Building frontend...')
  console.log(`   Command: ${buildCommand}\n`)

  const proc = Bun.spawn(buildCommand.split(' '), {
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(`Build failed with exit code ${exitCode}`)
  }

  console.log('   ✅ Build completed')
}

/**
 * Build and deploy frontend
 */
export async function buildAndDeploy(options: DeployOptions & { buildCommand?: string }): Promise<void> {
  const { buildCommand, ...deployOptions } = options

  await buildFrontend(buildCommand)
  await deployFrontend(deployOptions)
}
