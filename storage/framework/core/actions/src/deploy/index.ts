import type { Subprocess } from '@stacksjs/types'
import process from 'node:process'
import { runCommand, spinner } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

// Use console.log for clean output
const log = {
  debug: (...args: any[]) => {
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log('🔍', ...args)
    }
  },
  success: (...args: any[]) => console.log('✓', ...args),
  error: (...args: any[]) => console.error('✗', ...args),
}

// Check if verbose mode is enabled via CLI args
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

// Build framework - show output so user knows it's working
// Temporarily skip framework build due to bun workspace issue
// Framework was already built in previous deployment
log.debug('Skipping framework build (already built)...')
// await runCommand('bun run build', {
//   cwd: p.frameworkPath(),
//   quiet: false,  // Always show build output so it doesn't appear stuck
// })
log.success('Framework build skipped')

// Build documentation with BunPress
// Skip if docs directory doesn't exist or if pre-built docs exist
const docsDir = p.projectPath('docs')
const docsDistExists = storage.hasFiles(p.projectPath('dist/docs/.bunpress'))
if (storage.hasFiles(docsDir) && !docsDistExists) {
  const docsSpinner = spinner('Building documentation with BunPress...')
  docsSpinner.start()
  try {
    // Try to run bunpress from node_modules/.bin or linked package
    // Note: bunpress outputs to .bunpress subdirectory within outdir
    await runCommand('bunx @stacksjs/bunpress build --dir ./docs --outdir ./dist/docs', {
      cwd: p.projectPath(),
      quiet: !isVerbose,
    })
    docsSpinner.succeed('Documentation built with BunPress')
  } catch (docsError: any) {
    // BunPress might not be installed - skip gracefully
    docsSpinner.warn(`Documentation build skipped: ${docsError.message}`)
    if (isVerbose) log.debug('To build docs manually: cd ~/Code/bunpress && bun bin/cli.ts build --dir /path/to/docs --outdir /path/to/dist/docs')
  }
} else if (docsDistExists) {
  if (isVerbose) log.debug('Pre-built docs found at dist/docs/.bunpress, skipping build')
} else {
  if (isVerbose) log.debug('No docs directory found, skipping documentation build')
}

// Skip views build for now - vite-config is not set up
// TODO: Set up vite-config for views build
// if (config.app.docMode !== true) {
//   const viewsSpinner = spinner('Building views...')
//   viewsSpinner.start()
//   await runCommand('bun run build', {
//     cwd: p.frameworkPath('views/web'),
//     quiet: !isVerbose,
//   })
//   viewsSpinner.succeed('Views built')
// }
if (isVerbose) log.debug('Skipping views build (vite-config not configured)')

// await runCommand('bun run build-edge', {
//   cwd: p.corePath('cloud'),
// })

// Build server
const serverSpinner = spinner('Building server...')
serverSpinner.start()
await runCommand('bun build.ts', {
  cwd: p.frameworkPath('server'),
  quiet: !isVerbose,
})
serverSpinner.succeed('Server built')

// Package for deployment
const packageSpinner = spinner('Packaging for deployment...')
packageSpinner.start()
await runCommand('bun zip.ts', {
  cwd: p.corePath('cloud'),
  quiet: !isVerbose,
})
packageSpinner.succeed('Package ready')

// Load AWS credentials from environment-specific .env file if not already set
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  const { existsSync, readFileSync } = await import('node:fs')
  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'

  // Try environment-specific file first (e.g., .env.staging, .env.production)
  const envFiles = [
    p.projectPath(`.env.${environment}`),
    p.projectPath('.env'),
  ]

  for (const envPath of envFiles) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim()
        if (key === 'AWS_ACCESS_KEY_ID' && value) process.env.AWS_ACCESS_KEY_ID = value
        else if (key === 'AWS_SECRET_ACCESS_KEY' && value) process.env.AWS_SECRET_ACCESS_KEY = value
        else if (key === 'AWS_REGION' && value && !process.env.AWS_REGION) process.env.AWS_REGION = value
        else if (key === 'AWS_ACCOUNT_ID' && value && !process.env.AWS_ACCOUNT_ID) process.env.AWS_ACCOUNT_ID = value
      }
      if (isVerbose) log.debug(`Loaded AWS credentials from ${envPath}`)
      break // Stop after loading the first existing file
    }
  }
}

// Use ts-cloud deployment instead of CDK
try {
  const { deployStack, deployFrontend } = await import('../../deploy')

  const environment = process.env.APP_ENV || process.env.NODE_ENV || 'production'
  const region = process.env.AWS_REGION || 'us-east-1'

  // Check deployment mode - use relative import from project root
  const cloudConfigModule = await import(p.projectPath('config/cloud'))
  const deploymentMode = cloudConfigModule?.tsCloud?.infrastructure?.mode || 'server'

  // For serverless mode, build and push container image before deploying infrastructure
  if (deploymentMode === 'serverless') {
    console.log('')
    console.log('Serverless deployment mode detected')
    console.log('Building and pushing container image...')
    console.log('')

    // Get AWS account ID for ECR
    const accountId = process.env.AWS_ACCOUNT_ID || await getAwsAccountId(region)
    const projectName = cloudConfigModule?.tsCloud?.project?.name || 'stacks'
    const ecrRepository = `${accountId}.dkr.ecr.${region}.amazonaws.com/${projectName}-${environment}-api`
    const imageTag = `${ecrRepository}:latest`

    // Step 1: Verify ECR credentials (actual login happens before push)
    if (isVerbose) log.debug('ECR credentials will be validated before push...')

    // Step 2: Build Docker image
    const buildSpinner = spinner('Building Docker image...')
    buildSpinner.start()

    try {
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)

      const buildCmd = `docker build --platform linux/amd64 -t ${imageTag} -f Dockerfile .`
      const { stdout, stderr } = await execAsync(buildCmd, {
        cwd: p.projectPath(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for Docker output
      })
      if (isVerbose && stdout) log.debug(stdout)
      if (isVerbose && stderr) log.debug(stderr)
      buildSpinner.succeed(`Docker image built: ${imageTag}`)
    } catch (error: any) {
      buildSpinner.fail('Docker build failed')
      if (isVerbose) log.debug(`Docker build error: ${error.message}`)
      throw error
    }

    // Step 3: Ensure ECR repository exists (create if needed)
    const repoSpinner = spinner('Checking ECR repository...')
    repoSpinner.start()

    try {
      const { ECRClient } = await import('ts-cloud/aws')
      const ecr = new ECRClient(region)
      const repoName = `${projectName}-${environment}-api`

      // Check if repository exists
      try {
        await ecr.describeRepositories({ repositoryNames: [repoName] })
        repoSpinner.succeed(`ECR repository exists: ${repoName}`)
      } catch (err: any) {
        // Repository doesn't exist, create it
        if (err.code === 'RepositoryNotFoundException' || err.message?.includes('RepositoryNotFoundException')) {
          repoSpinner.text = `Creating ECR repository: ${repoName}...`
          await ecr.createRepository({
            repositoryName: repoName,
            imageScanningConfiguration: { scanOnPush: true },
            imageTagMutability: 'MUTABLE',
          })
          repoSpinner.succeed(`ECR repository created: ${repoName}`)
        } else {
          throw err
        }
      }
    } catch (error: any) {
      repoSpinner.fail('ECR repository check failed')
      if (isVerbose) log.debug(`ECR repository error: ${error.message}`)
      throw error
    }

    // Step 4: Re-authenticate to ECR immediately before push
    const authSpinner = spinner('Authenticating to ECR...')
    authSpinner.start()

    try {
      const { ECRClient } = await import('ts-cloud/aws')
      const ecr = new ECRClient(region)

      // Get ECR authorization token
      const authData = await ecr.getAuthorizationToken()
      const token = authData.authorizationData?.[0]

      if (!token?.authorizationToken) {
        throw new Error('No authorization token received from ECR')
      }

      // Decode base64 token (format: AWS:password)
      const decoded = Buffer.from(token.authorizationToken, 'base64').toString('utf-8')
      const password = decoded.split(':')[1]

      // Login to Docker using stdin for password (secure)
      const loginResult = Bun.spawnSync([
        'docker',
        'login',
        '--username',
        'AWS',
        '--password-stdin',
        `${accountId}.dkr.ecr.${region}.amazonaws.com`,
      ], {
        stdin: new TextEncoder().encode(password),
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (loginResult.exitCode !== 0) {
        const loginError = new TextDecoder().decode(loginResult.stderr)
        throw new Error(`Docker login failed: ${loginError}`)
      }

      authSpinner.succeed('Authenticated to ECR')
    } catch (error: any) {
      authSpinner.fail('ECR authentication failed')
      if (isVerbose) log.debug(`ECR auth error: ${error.message}`)
      throw error
    }

    // Step 5: Push Docker image to ECR
    console.log('')
    const pushSpinner = spinner('Pushing image to ECR...')
    pushSpinner.start()

    try {
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)

      const pushCmd = `docker push ${imageTag}`
      await execAsync(pushCmd, { env: process.env })
      pushSpinner.succeed(`Image pushed: ${imageTag}`)
    } catch (error: any) {
      pushSpinner.fail('Docker push failed')
      if (isVerbose) log.debug(`Push error: ${error.message}`)
      throw error
    }

    console.log('')
    console.log('Container image ready in ECR. CloudFormation will use this image.')
    console.log('')
  }

  // Helper function to get AWS account ID using ts-cloud SDK
  async function getAwsAccountId(region: string): Promise<string> {
    try {
      const { STSClient } = await import('ts-cloud/aws')
      const sts = new STSClient(region)
      const identity = await sts.getCallerIdentity()
      return identity.Account || process.env.AWS_ACCOUNT_ID || ''
    } catch (error) {
      // Fallback to environment variable
      return process.env.AWS_ACCOUNT_ID || ''
    }
  }

  // Deploy infrastructure stack
  // Note: For serverless mode, the Docker image is already pushed to ECR above
  // Note: deployStack outputs its own progress table, so we don't use a spinner here
  await deployStack({
    environment,
    region,
    waitForCompletion: true,
    verbose: isVerbose,
  })

  // Run database migrations after infrastructure is deployed
  // This ensures the RDS database is available before we try to migrate
  const migrateSpinner = spinner('Running database migrations...')
  migrateSpinner.start()
  try {
    const { generateMigrations, runDatabaseMigration } = await import('@stacksjs/database')

    // Generate migrations from models
    await generateMigrations()

    // Execute migrations against the production database
    await runDatabaseMigration()

    migrateSpinner.succeed('Database migrations completed')
  } catch (migrationError: any) {
    // Don't fail the entire deployment if migrations fail
    // The database might not be accessible from the deploy machine
    migrateSpinner.warn(`Database migrations skipped: ${migrationError.message}`)
    if (isVerbose) log.debug(`Migration error: ${migrationError.stack}`)
  }

  // Deploy frontend to S3
  const frontendSpinner = spinner('Deploying frontend to S3...')
  frontendSpinner.start()

  try {
    const { S3Client, CloudFormationClient } = await import('ts-cloud/aws')
    const { existsSync, readdirSync, statSync, readFileSync, copyFileSync, mkdirSync, rmSync } = await import('node:fs')
    const { join, extname, relative } = await import('node:path')

    const s3 = new S3Client(region)
    const cf = new CloudFormationClient(region)

    // Get bucket name from stack outputs
    const stackName = `stacks-cloud-${environment}`
    const outputs = await cf.getStackOutputs(stackName)
    const bucketName = outputs.FrontendBucketName

    if (!bucketName) {
      frontendSpinner.fail('Frontend bucket not found in stack outputs')
    } else {
      // Build directory for frontend files
      const buildDir = p.storagePath('framework/frontend-dist')

      // Clean and create build directory
      if (existsSync(buildDir)) {
        rmSync(buildDir, { recursive: true })
      }
      mkdirSync(buildDir, { recursive: true })
      mkdirSync(join(buildDir, 'assets'), { recursive: true })

      // Copy index.stx as index.html
      const indexPath = p.resourcesPath('views/index.stx')
      if (existsSync(indexPath)) {
        copyFileSync(indexPath, join(buildDir, 'index.html'))
        if (isVerbose) log.debug(`  Copied index.stx -> index.html`)
      } else {
        // Fallback to default index
        const defaultIndex = `<!DOCTYPE html>
<html><head><title>Stacks</title></head>
<body><h1>Welcome to Stacks</h1></body></html>`
        const { writeFileSync } = await import('node:fs')
        writeFileSync(join(buildDir, 'index.html'), defaultIndex)
      }

      // Copy assets directory
      const assetsPath = p.resourcesPath('assets')
      if (existsSync(assetsPath)) {
        const copyDir = (src: string, dest: string) => {
          if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
          for (const item of readdirSync(src)) {
            const srcPath = join(src, item)
            const destPath = join(dest, item)
            if (statSync(srcPath).isDirectory()) {
              copyDir(srcPath, destPath)
            } else {
              copyFileSync(srcPath, destPath)
            }
          }
        }
        copyDir(assetsPath, join(buildDir, 'assets'))
        if (isVerbose) log.debug(`  Copied assets directory`)
      }

      // Upload files to S3
      const getMimeType = (filePath: string): string => {
        const ext = extname(filePath).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.eot': 'application/vnd.ms-fontobject',
          '.otf': 'font/otf',
          '.webp': 'image/webp',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.pdf': 'application/pdf',
          '.xml': 'application/xml',
          '.txt': 'text/plain',
        }
        return mimeTypes[ext] || 'application/octet-stream'
      }

      const uploadDir = async (dir: string, prefix: string = '') => {
        const items = readdirSync(dir)
        for (const item of items) {
          if (item === '.DS_Store') continue // Skip macOS files
          const filePath = join(dir, item)
          const key = prefix ? `${prefix}/${item}` : item

          if (statSync(filePath).isDirectory()) {
            await uploadDir(filePath, key)
          } else {
            const content = readFileSync(filePath)
            const contentType = getMimeType(filePath)
            const cacheControl = item === 'index.html'
              ? 'no-cache, no-store, must-revalidate'
              : 'public, max-age=31536000, immutable'

            await s3.putObject({
              bucket: bucketName,
              key: key,
              body: content,
              contentType: contentType,
              cacheControl: cacheControl,
            })
            if (isVerbose) log.debug(`  Uploaded: ${key}`)
          }
        }
      }

      await uploadDir(buildDir)

      // Invalidate CloudFront cache if distribution exists
      const distributionId = outputs.CloudFrontDistributionId
      if (distributionId) {
        if (isVerbose) log.debug('  Invalidating CloudFront cache...')
        const { AWSClient } = await import('ts-cloud/aws')
        const client = new AWSClient()
        await client.request({
          service: 'cloudfront',
          region: 'us-east-1', // CloudFront is always us-east-1
          method: 'POST',
          path: `/2020-05-31/distribution/${distributionId}/invalidation`,
          headers: {
            'Content-Type': 'application/xml',
          },
          body: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>${Date.now()}</CallerReference>
  <Paths>
    <Quantity>1</Quantity>
    <Items>
      <Path>/*</Path>
    </Items>
  </Paths>
</InvalidationBatch>`,
        })
      }

      frontendSpinner.succeed(`Frontend deployed to S3 (${bucketName})`)
    }
  } catch (frontendError: any) {
    frontendSpinner.fail(`Frontend deployment failed: ${frontendError.message}`)
    if (isVerbose) log.debug(`Frontend error: ${frontendError.stack}`)
  }

  // Deploy documentation to S3
  // Note: BunPress outputs to .bunpress subdirectory within outdir
  const docsDistPath = p.projectPath('dist/docs/.bunpress')
  const { existsSync: docsExists } = await import('node:fs')
  if (docsExists(docsDistPath)) {
    const docsDeploySpinner = spinner('Deploying documentation to S3...')
    docsDeploySpinner.start()

    try {
      const { S3Client, CloudFormationClient } = await import('ts-cloud/aws')
      const { readdirSync, statSync, readFileSync } = await import('node:fs')
      const { join, extname } = await import('node:path')

      const s3 = new S3Client(region)
      const cf = new CloudFormationClient(region)

      // Get docs bucket name from stack outputs
      const stackName = `stacks-cloud-${environment}`
      const outputs = await cf.getStackOutputs(stackName)
      const docsBucketName = outputs.DocsBucketName

      if (!docsBucketName) {
        docsDeploySpinner.warn('Docs bucket not found in stack outputs (infrastructure may not be updated yet)')
      } else {
        // MIME type helper
        const getMimeType = (filePath: string): string => {
          const ext = extname(filePath).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.xml': 'application/xml',
            '.txt': 'text/plain',
          }
          return mimeTypes[ext] || 'application/octet-stream'
        }

        // Upload docs files to S3 (files go to root since CloudFront routes /docs/* to this bucket)
        const uploadDocsDir = async (dir: string, prefix: string = '') => {
          const items = readdirSync(dir)
          for (const item of items) {
            if (item === '.DS_Store' || item === '.bunpress') continue
            const filePath = join(dir, item)
            const key = prefix ? `${prefix}/${item}` : item

            if (statSync(filePath).isDirectory()) {
              await uploadDocsDir(filePath, key)
            } else {
              const content = readFileSync(filePath)
              const contentType = getMimeType(filePath)
              const cacheControl = item.endsWith('.html')
                ? 'no-cache, no-store, must-revalidate'
                : 'public, max-age=31536000, immutable'

              await s3.putObject({
                bucket: docsBucketName,
                key: key,
                body: content,
                contentType: contentType,
                cacheControl: cacheControl,
              })
              if (isVerbose) log.debug(`  Uploaded docs: ${key}`)
            }
          }
        }

        await uploadDocsDir(docsDistPath)

        // Invalidate CloudFront cache for /docs paths
        const distributionId = outputs.CloudFrontDistributionId
        if (distributionId) {
          if (isVerbose) log.debug('  Invalidating CloudFront cache for /docs...')
          const { AWSClient } = await import('ts-cloud/aws')
          const client = new AWSClient()
          await client.request({
            service: 'cloudfront',
            region: 'us-east-1',
            method: 'POST',
            path: `/2020-05-31/distribution/${distributionId}/invalidation`,
            headers: {
              'Content-Type': 'application/xml',
            },
            body: `<?xml version="1.0" encoding="UTF-8"?>
<InvalidationBatch xmlns="http://cloudfront.amazonaws.com/doc/2020-05-31/">
  <CallerReference>docs-${Date.now()}</CallerReference>
  <Paths>
    <Quantity>2</Quantity>
    <Items>
      <Path>/docs</Path>
      <Path>/docs/*</Path>
    </Items>
  </Paths>
</InvalidationBatch>`,
          })
        }

        docsDeploySpinner.succeed(`Documentation deployed to S3 (${docsBucketName})`)
      }
    } catch (docsDeployError: any) {
      docsDeploySpinner.fail(`Documentation deployment failed: ${docsDeployError.message}`)
      if (isVerbose) log.debug(`Docs deploy error: ${docsDeployError.stack}`)
    }
  } else {
    if (isVerbose) log.debug('No docs build found at dist/docs, skipping docs deployment')
  }

  console.log('')
  log.success('Deployment completed successfully!')
} catch (error) {
  log.error('Deployment failed:', error)
  process.exit(ExitCode.FatalError)
}

// Legacy CDK deployment (commented out for reference)
// const profile = process.env.AWS_PROFILE ?? 'stacks'
// const result = await runCommand(`bunx --bun cdk deploy --require-approval never --profile="${profile}"`, {
//   cwd: p.frameworkCloudPath(),
// })
// if (result.isErr()) {
//   log.error(result.error)
//   process.exit(ExitCode.FatalError)
// }
// const t = result.value as Subprocess
// await t.exited
